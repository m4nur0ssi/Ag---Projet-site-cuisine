'use client';

/**
 * Mode d'emploi de l'extension Chrome « Courses Magiques ».
 *
 * L'extension pousse la liste de courses DANS le site du magasin : elle lance
 * la recherche du premier ingrédient, puis fait défiler les suivants sans
 * jamais changer d'onglet, et raye chaque article dans la liste restée
 * ouverte. Encore fallait-il savoir qu'elle existe et comment l'installer —
 * d'où cet écran.
 *
 * Il dit d'emblée que c'est un outil d'ORDINATEUR : une extension Chrome ne
 * s'installe pas sur iPhone, et laisser quelqu'un tenter l'installation depuis
 * son téléphone serait une perte de temps déguisée en fonctionnalité.
 */

import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import styles from './tv.module.css';

const MAGASINS = ['Carrefour', 'Picard', 'Monoprix', 'Leclerc Drive'];

const INSTALLATION = [
    ['Télécharge le fichier', 'Le bouton ci-dessous enregistre courses-magiques-extension.zip.'],
    ['Décompresse-le', 'Un double-clic suffit : tu obtiens un dossier du même nom. Garde-le, ne le jette pas — Chrome lit l’extension depuis ce dossier.'],
    ['Ouvre la page des extensions', 'Dans Chrome, saisis chrome://extensions dans la barre d’adresse.'],
    ['Active le « Mode développeur »', 'L’interrupteur est en haut à droite de cette page.'],
    ['Charge l’extension', 'Bouton « Charger l’extension non empaquetée », puis choisis le dossier décompressé.'],
];

const USAGE = [
    ['Ouvre ta liste de courses', 'Sur ce site, menu → Liste de courses.'],
    ['Coche ce que tu veux acheter', 'Seuls les articles cochés partent au magasin.'],
    ['Appuie sur « Magasin »', 'Le bouton n’apparaît qu’une fois au moins un article coché. Choisis l’enseigne.'],
    ['Le magasin s’ouvre, déjà en recherche', 'Un onglet s’ouvre sur le premier ingrédient, la recherche est lancée toute seule.'],
    ['Mets au panier, puis « suivant »', 'La pastille en bas à droite passe à l’ingrédient suivant, sans changer d’onglet.'],
    ['L’article se raye tout seul', 'Dans ta liste restée ouverte, chaque article validé se barre au fur et à mesure.'],
];

export default function ExtensionGuide({ onClose, embedded = false }: { onClose: () => void; embedded?: boolean }) {
    // Échap ferme, comme partout ailleurs.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Pas de garde « monté » : ce composant n'est chargé qu'au clic, côté
    // navigateur uniquement (ssr: false). Le garde ne servait qu'à retarder son
    // apparition d'un rendu.
    const corps = (
        <div className={`${styles.extGuide} ${embedded ? styles.extEmbedded : ''}`}>
            <div className={styles.extHead}>
                {/* Sur ordinateur, la page vit DANS le cadre, à droite du menu :
                    pas de bouton retour, on change de page par le menu. */}
                {!embedded && (
                    <button className={styles.extBack} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 18l-6-6 6-6" />
                        </svg>
                    </button>
                )}
                <span className={styles.extKicker}>Courses</span>
            </div>

            <div className={styles.extScroll}>
                <h1 className={styles.extTitle}>Extension Chrome</h1>
                <p className={styles.extLead}>
                    Ta liste de courses, poussée directement dans le site du magasin. L’extension
                    cherche le premier ingrédient, puis enchaîne les suivants sans que tu changes
                    d’onglet — et raye chaque article dans ta liste au fur et à mesure.
                </p>

                <div className={styles.extStores}>
                    {MAGASINS.map((m) => <span key={m} className={styles.extStore}>{m}</span>)}
                </div>

                {/* Dit avant tout le reste : personne ne doit s'acharner depuis son téléphone. */}
                <div className={styles.extNote}>
                    À faire sur un <strong>ordinateur</strong>, dans Chrome. Une extension ne
                    s’installe pas sur iPhone ni sur iPad.
                </div>

                <h2 className={styles.extSection}>Installer</h2>
                <ol className={styles.extSteps}>
                    {INSTALLATION.map(([titre, detail], i) => (
                        <li key={titre} className={styles.extStep}>
                            <span className={styles.extNum}>{i + 1}</span>
                            <span className={styles.extStepTexts}>
                                <span className={styles.extStepTitle}>{titre}</span>
                                <span className={styles.extStepDetail}>{detail}</span>
                            </span>
                        </li>
                    ))}
                </ol>

                <a className={styles.extDownload} href="/courses-magiques-extension.zip" download>
                    Télécharger l’extension
                </a>

                <h2 className={styles.extSection}>S’en servir</h2>
                <ol className={styles.extSteps}>
                    {USAGE.map(([titre, detail], i) => (
                        <li key={titre} className={styles.extStep}>
                            <span className={styles.extNum}>{i + 1}</span>
                            <span className={styles.extStepTexts}>
                                <span className={styles.extStepTitle}>{titre}</span>
                                <span className={styles.extStepDetail}>{detail}</span>
                            </span>
                        </li>
                    ))}
                </ol>

                <h2 className={styles.extSection}>Bon à savoir</h2>
                <ul className={styles.extFacts}>
                    <li>
                        La liste en cours est retenue : si tu fermes l’onglet du magasin, la
                        pastille te la rend à ton retour, au même ingrédient.
                    </li>
                    <li>
                        Sans liste en cours, une pastille discrète reste en bas à droite des sites
                        de magasin pour rejoindre ta liste. La croix la range.
                    </li>
                    <li>
                        Chrome peut signaler l’extension comme « non vérifiée » : c’est le mode
                        développeur, normal pour une extension qui ne passe pas par le Store.
                    </li>
                </ul>
            </div>
        </div>
    );

    // Sur téléphone, c'est un écran plein posé par-dessus ; sur ordinateur, un
    // panneau parmi les autres, qui s'élargit quand on replie le menu.
    return embedded ? corps : createPortal(corps, document.body);
}
