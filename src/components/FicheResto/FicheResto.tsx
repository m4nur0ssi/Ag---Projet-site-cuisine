'use client';

/**
 * FicheResto — le corps d'une fiche « Comme au resto ».
 *
 * Ces fiches racontent des lieux VISITÉS : le plat commandé, ce qu'on a aimé, la
 * table où l'on s'est assis. Tout cela existait déjà dans les données, rédigé, et
 * rien ne l'affichait — le bloc d'onglets qui rend `steps` est coupé pour la
 * catégorie restaurant. Ce composant redonne ce contenu, dans l'ordre où on le
 * cherche : mon avis, la carte, le lieu, comment y aller.
 *
 * Un seul composant pour le téléphone ET le bureau. Les deux arbres du projet ont
 * l'habitude de diverger ; ici la seule pièce qui diffère (les étoiles, dont les
 * deux versions ne sont pas les mêmes) arrive en accessoire.
 *
 * Règle de fond : on n'invente rien. Un champ absent ne dessine pas sa case, et
 * les horaires ne montrent « ouvert » que si le format a été compris.
 */

import React, { useMemo } from 'react';
import { lireFicheResto, horairesLisibles, fourchetteResto } from '@/lib/restaurant';
import CookingJournal from '@/components/CookingJournal/CookingJournal';
import styles from './FicheResto.module.css';

/**
 * Le projet porte DEUX déclarations de `Recipe` (bureau et téléphone) qui ont
 * divergé. Importer l'une des deux fâcherait l'autre appelant ; on ne décrit donc
 * ici que ce dont la fiche a réellement besoin.
 */
export interface RecetteResto {
    id: string;
    title: string;
    steps?: string[];
    description?: string;
    address?: string;
    website?: string;
    restaurant?: {
        name?: string;
        priceLevel?: 1 | 2 | 3;
        parking?: boolean;
        terrace?: boolean;
        rating?: number;
        reviewsCount?: number;
        tripAdvisorUrl?: string;
        website?: string;
        hours?: string;
        address?: string;
        phone?: string;
        mapsUrl?: string;
        mapsQuery?: string;
        locations?: { name?: string; address: string; phone?: string }[];
    };
}

/* Icônes au trait, dans l'esprit du reste du site : pas d'émoticône. */
const Ico = {
    euro: 'M15 6.5A5.5 5.5 0 0 0 7.2 9m7.8 8.5A5.5 5.5 0 0 1 7.2 15M4 10.5h7M4 13.5h7',
    etoile: 'm12 3 2.6 5.6 6.1.8-4.5 4.2 1.2 6.1L12 16.8 6.6 19.7l1.2-6.1L3.3 9.4l6.1-.8L12 3Z',
    soleil: 'M12 4v2m0 12v2M4 12H2m20 0h-2M6 6 4.6 4.6M19.4 19.4 18 18M6 18l-1.4 1.4M19.4 4.6 18 6M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    voiture: 'M5 17h14M5 17a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0m18 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0M3 12l1.6-4.4A2 2 0 0 1 6.5 6h11a2 2 0 0 1 1.9 1.6L21 12v5H3v-5Z',
    horloge: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    epingle: 'M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    tel: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6 6L16.5 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3.5 5.2 2 2 0 0 1 5.5 3Z',
    metro: 'M8 3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM5 10h14M8.5 20 6 22m9.5-2 2.5 2M9 13.5h.01M15 13.5h.01',
    couverts: 'M6 3v7a2 2 0 0 0 4 0V3M8 10v11M17 3c-1.7 1-2.5 3-2.5 5.5S15.3 13 17 13.5V21',
    coeur: 'M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7.4 4.1 4.1 0 0 1 19 10.6c0 5-7 9.4-7 9.4Z',
    plus: 'M12 5v14M5 12h14',
    moins: 'M5 12h14',
    chaise: 'M6 4h12v7H6zM7 11l-1 9M17 11l1 9M5 15h14',
};

function Trait({ d, taille = 18 }: { d: string; taille?: number }) {
    return (
        <svg className={styles.ico} width={taille} height={taille} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={d} />
        </svg>
    );
}

function Section({ kicker, titre, children }: { kicker: string; titre: string; children: React.ReactNode }) {
    return (
        <section className={styles.section}>
            <p className={styles.kicker}>{kicker}</p>
            <h3 className={styles.titre}>{titre}</h3>
            {children}
        </section>
    );
}

export default function FicheResto({
    recipe,
    note,
}: {
    recipe: RecetteResto;
    note?: React.ReactNode;
}) {
    const r = recipe.restaurant;
    const nom = r?.name || recipe.title;
    const lu = useMemo(() => lireFicheResto(recipe.steps, nom), [recipe.steps, nom]);

    // Le chapeau de la fiche reprend souvent, mot pour mot, le premier paragraphe
    // du texte. L'afficher deux fois à trente lignes d'écart donne l'impression
    // d'un bug ; on garde celui du haut et on retire le doublon d'ici.
    const presentation = useMemo(() => {
        const aplatir = (t: string) =>
            (t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const chapeau = aplatir(recipe.description || '');
        if (!chapeau) return lu.presentation;
        return lu.presentation.filter((par) => {
            const corps = aplatir(par.corps);
            if (!corps) return false;
            const empreinte = corps.slice(0, Math.min(60, corps.length));
            return !chapeau.includes(empreinte);
        });
    }, [lu.presentation, recipe.description]);
    // L'heure d'ouverture se relit à chaque rendu : la pastille suit la journée.
    const heures = useMemo(() => horairesLisibles(r?.hours), [r?.hours]);

    const adresse = r?.address || recipe.address || lu.pratique.adresse || '';
    const site = r?.website || recipe.website || '';
    const fourchette = fourchetteResto(r?.priceLevel);
    const aUnAvis = !!(lu.avis.platPrefere || lu.avis.aime || lu.avis.moinsAime || lu.avis.table);

    // Sans adresse, un bouton « Google Maps » chercherait le titre au hasard.
    // Mieux vaut n'afficher que ce qui mène vraiment quelque part.
    const requete = adresse || (r?.mapsQuery ? r.mapsQuery : '');
    const lienMaps = r?.mapsUrl
        || (requete ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(requete)}` : '');
    const lienPlans = requete ? `https://maps.apple.com/?q=${encodeURIComponent(requete)}` : '';

    return (
        <div className={styles.fiche}>
            {/* ── Repères : uniquement ce que l'on sait vraiment ── */}
            {(fourchette || typeof r?.rating === 'number' || r?.terrace || r?.parking || heures) && (
                <div className={styles.reperes}>
                    {heures && (
                        <span className={`${styles.repere} ${heures.ouvert === true ? styles.ouvert : heures.ouvert === false ? styles.ferme : ''}`}>
                            <Trait d={Ico.horloge} taille={15} />
                            {heures.ouvert === true ? 'Ouvert' : heures.ouvert === false ? 'Fermé' : 'Horaires'}
                        </span>
                    )}
                    {fourchette && (
                        <span className={styles.repere}><Trait d={Ico.euro} taille={15} />{fourchette}</span>
                    )}
                    {typeof r?.rating === 'number' && (
                        <a
                            className={`${styles.repere} ${styles.repereLien}`}
                            href={r.tripAdvisorUrl || lienMaps || '#'}
                            target="_blank" rel="noopener noreferrer"
                        >
                            <Trait d={Ico.etoile} taille={15} />
                            {r.rating.toFixed(1).replace('.', ',')}
                            {r.reviewsCount ? <span className={styles.repereFin}>{r.reviewsCount} avis</span> : null}
                        </a>
                    )}
                    {r?.terrace && <span className={styles.repere}><Trait d={Ico.soleil} taille={15} />Terrasse</span>}
                    {r?.parking && <span className={styles.repere}><Trait d={Ico.voiture} taille={15} />Parking</span>}
                </div>
            )}

            {/* ── Ce que TU en as pensé : la raison d'être de la rubrique ── */}
            {(aUnAvis || note) && (
                <Section kicker="Ta visite" titre="Ce que tu en as pensé">
                    {lu.avis.platPrefere && (
                        <div className={styles.plat}>
                            <p className={styles.platLabel}><Trait d={Ico.couverts} taille={15} />Mon plat préféré</p>
                            <p className={styles.platNom}>{lu.avis.platPrefere}</p>
                        </div>
                    )}

                    {(lu.avis.aime || lu.avis.moinsAime) && (
                        <div className={styles.duo}>
                            {lu.avis.aime && (
                                <div className={`${styles.carte} ${styles.bon}`}>
                                    <p className={styles.carteLabel}><Trait d={Ico.plus} taille={14} />J’ai aimé</p>
                                    <p className={styles.carteTexte}>{lu.avis.aime}</p>
                                </div>
                            )}
                            {lu.avis.moinsAime && (
                                <div className={`${styles.carte} ${styles.moins}`}>
                                    <p className={styles.carteLabel}><Trait d={Ico.moins} taille={14} />J’ai moins aimé</p>
                                    <p className={styles.carteTexte}>{lu.avis.moinsAime}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {lu.avis.table && (
                        <div className={styles.table}>
                            <Trait d={Ico.chaise} taille={16} />
                            <span><span className={styles.tableLabel}>Ma table :</span> {lu.avis.table}</span>
                        </div>
                    )}

                    {/* Les étoiles portent déjà leur propre libellé : en ajouter un
                        second (« Ma note » à côté de « Votre note ») disait deux fois
                        la même chose et cassait leur mise en page. */}
                    {note && <div className={styles.notes}>{note}</div>}
                    <CookingJournal recipeId={recipe.id} variant="restaurant" />
                </Section>
            )}

            {/* ── La carte relevée dans la vidéo, prix compris ── */}
            {lu.menu.length >= 2 && (
                <Section kicker="À la carte" titre="Ce qu'on a mangé">
                    <ul className={styles.menu}>
                        {lu.menu.map((p, i) => (
                            <li key={i} className={styles.menuLigne}>
                                <span className={styles.menuNom}>{p.nom}</span>
                                <span className={styles.menuPointille} aria-hidden="true" />
                                <span className={styles.menuPrix}>{p.prix} €</span>
                            </li>
                        ))}
                    </ul>
                    <p className={styles.menuTotal}>
                        {lu.menu.length} plats relevés dans la vidéo
                        <span className={styles.menuTotalPrix}>{Math.round(lu.total)} €</span>
                    </p>
                </Section>
            )}

            {/* ── Le texte rédigé, enfin visible ── */}
            {presentation.length > 0 && (
                <Section kicker="L'adresse" titre="Le lieu">
                    <div className={styles.lieu}>
                        {presentation.map((p, i) => (
                            <div key={i} className={styles.para}>
                                {p.titre && <h4 className={styles.paraTitre}>{p.titre}</h4>}
                                <p className={styles.paraTexte}>{p.corps}</p>
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            {/* ── Y aller : une seule zone, plus deux boutons qui redisent l'adresse ── */}
            {(adresse || heures || r?.phone || lu.pratique.transports.length || lu.pratique.parking || site || r?.tripAdvisorUrl || (r?.locations?.length || 0) > 1) && (
                <Section kicker="Pratique" titre="S'y rendre">
                    <div className={styles.infos}>
                        {(r?.locations?.length || 0) > 1 ? (
                            r!.locations!.map((loc, i) => (
                                <a key={i} className={styles.ligne}
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((loc.name ? loc.name + ' ' : '') + loc.address)}`}
                                    target="_blank" rel="noopener noreferrer">
                                    <Trait d={Ico.epingle} />
                                    <span>{loc.name ? `${loc.name} — ${loc.address}` : loc.address}</span>
                                </a>
                            ))
                        ) : adresse ? (
                            <a className={styles.ligne} href={lienMaps || '#'} target="_blank" rel="noopener noreferrer">
                                <Trait d={Ico.epingle} /><span>{adresse}</span>
                            </a>
                        ) : null}

                        {heures && (
                            <div className={styles.ligne}>
                                <Trait d={Ico.horloge} />
                                <span>
                                    {heures.texte}
                                    {heures.ouvert !== null && (
                                        <span className={heures.ouvert ? styles.pointOuvert : styles.pointFerme}>
                                            {heures.ouvert ? 'Ouvert maintenant' : 'Fermé maintenant'}
                                        </span>
                                    )}
                                </span>
                            </div>
                        )}

                        {r?.phone && (
                            <a className={styles.ligne} href={`tel:${r.phone.replace(/\s/g, '')}`}>
                                <Trait d={Ico.tel} /><span>{r.phone}</span>
                            </a>
                        )}

                        {lu.pratique.transports.map((t, i) => (
                            <div key={i} className={styles.ligne}><Trait d={Ico.metro} /><span>{t}</span></div>
                        ))}

                        {lu.pratique.parking && (
                            <div className={styles.ligne}><Trait d={Ico.voiture} /><span>{lu.pratique.parking}</span></div>
                        )}
                    </div>

                    <div className={styles.boutons}>
                        {lienMaps && <a className={styles.bouton} href={lienMaps} target="_blank" rel="noopener noreferrer">Google Maps</a>}
                        {lienPlans && <a className={styles.bouton} href={lienPlans} target="_blank" rel="noopener noreferrer">Plans</a>}
                        {site && <a className={styles.bouton} href={site} target="_blank" rel="noopener noreferrer">Site officiel</a>}
                        {r?.tripAdvisorUrl && (
                            <a className={`${styles.bouton} ${styles.boutonFort}`} href={r.tripAdvisorUrl} target="_blank" rel="noopener noreferrer">
                                Réserver
                            </a>
                        )}
                    </div>
                </Section>
            )}
        </div>
    );
}
