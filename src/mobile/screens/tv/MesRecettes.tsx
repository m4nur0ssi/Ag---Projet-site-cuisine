'use client';

/**
 * « J'ai vu une vidéo » — l'écran de mes recettes à moi.
 * =====================================================
 *
 * On colle le lien d'une vidéo, le serveur l'écoute (TikTok publie sa propre
 * transcription de la voix) et rend une fiche complète : ingrédients, étapes,
 * temps. Elle n'appartient qu'à celui qui l'a importée — rien n'est publié sur
 * le site, et la vidéo n'est pas réhébergée : on cite son auteur et on renvoie
 * chez lui.
 *
 * L'attente dure une poignée de secondes. Plutôt qu'un sablier muet, on dit ce
 * qui se passe : « on écoute la vidéo », puis « on note les ingrédients ». Ce
 * n'est pas de l'ornement — c'est ce qui fait la différence entre « ça rame »
 * et « ça travaille ».
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from './TVHome';
import { importerVideo, listerMesRecettes, oublierRecette, versFiche, type MaRecette } from '@/mobile/lib/mesRecettes';
import styles from './MesRecettes.module.css';

const ETAPES_ATTENTE = [
    'On ouvre la vidéo…',
    'On écoute ce qui se dit…',
    'On note les ingrédients…',
    'On met la recette au propre…',
];

export default function MesRecettes({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
    const [lien, setLien] = useState('');
    const [enCours, setEnCours] = useState(false);
    const [etape, setEtape] = useState(0);
    const [erreur, setErreur] = useState('');
    const [mesRecettes, setMesRecettes] = useState<MaRecette[]>([]);
    const saisieRef = useRef<HTMLInputElement>(null);

    const recharger = useCallback(async () => setMesRecettes(await listerMesRecettes()), []);
    useEffect(() => { recharger(); }, [recharger]);

    // Le texte d'attente avance tout seul : il raconte le travail réel, dont on
    // connaît l'ordre même si on ne connaît pas la durée.
    useEffect(() => {
        if (!enCours) { setEtape(0); return; }
        const t = setInterval(() => setEtape((n) => Math.min(n + 1, ETAPES_ATTENTE.length - 1)), 2600);
        return () => clearInterval(t);
    }, [enCours]);

    const ouvrirFiche = (m: MaRecette) => {
        const fiche = versFiche(m);
        if (!fiche) return;
        haptic(8);
        // La fiche flottante de l'app : même feuille que pour les recettes du
        // site, donc minuteur, liste de courses et planificateur compris.
        window.dispatchEvent(new CustomEvent('openRecipeFromPlanner', { detail: fiche }));
    };

    const lancer = async () => {
        const url = lien.trim();
        if (!url || enCours) return;
        setErreur('');
        setEnCours(true);
        haptic(10);
        const r = await importerVideo(url);
        setEnCours(false);
        if (!r.ok) { setErreur(r.raison || "Je n'ai pas pu lire cette vidéo."); return; }
        setLien('');
        await recharger();
        if (r.recette) ouvrirFiche(r.recette);
    };

    const oublier = async (e: React.MouseEvent, m: MaRecette) => {
        e.stopPropagation();
        haptic(8);
        setMesRecettes((liste) => liste.filter((x) => x.id !== m.id));
        await oublierRecette(m.id);
    };

    const pretes = mesRecettes.filter((m) => m.statut === 'prete' && m.recipe);

    return (
        /* Dans le cadre de bureau, l'écran s'installe DANS le panneau : ni fond
           opaque par-dessus la page, ni flèche de retour — la barre de gauche
           reste là et c'est elle qui fait la navigation. */
        <div className={embedded ? styles.embedded : styles.root}>
            <header className={styles.head}>
                {!embedded && (
                    <button className={styles.back} onClick={onClose} aria-label="Fermer">
                        <svg viewBox="0 0 8 14" fill="none" width="13" height="13">
                            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                )}
                <div>
                    <div className={styles.kicker}>Mes recettes</div>
                    <h1 className={styles.title}>J’ai vu une vidéo</h1>
                </div>
            </header>

            <div className={styles.champ}>
                <input
                    ref={saisieRef}
                    className={styles.saisie}
                    value={lien}
                    onChange={(e) => setLien(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lancer(); } }}
                    placeholder="Colle le lien de la vidéo"
                    type="url"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                />
                <button className={styles.go} onClick={lancer} disabled={!lien.trim() || enCours}>
                    {enCours ? '…' : 'Ajouter'}
                </button>
            </div>

            {!enCours && !erreur && (
                <p className={styles.aide}>
                    Depuis TikTok : « Partager », puis « Copier le lien ». La recette reste privée —
                    elle n’est visible que par toi.
                </p>
            )}

            {enCours && (
                <div className={styles.travail}>
                    <div className={styles.rond} />
                    <div className={styles.travailTexte}>{ETAPES_ATTENTE[etape]}</div>
                </div>
            )}

            {erreur && <div className={styles.erreur}>{erreur}</div>}

            <div className={styles.liste}>
                {pretes.length === 0 && !enCours && (
                    <p className={styles.vide}>
                        Rien ici pour l’instant. Colle le lien d’une vidéo de cuisine : j’en écoute la voix
                        et j’en écris la recette, avec ses ingrédients et ses étapes.
                    </p>
                )}
                {pretes.map((m) => (
                    <div key={m.id} className={styles.carte}>
                        <button className={styles.principal} onClick={() => ouvrirFiche(m)}>
                            {m.recipe?.image
                                ? <img className={styles.vignette} src={m.recipe.image} alt="" loading="lazy" />
                                : <div className={styles.vignette} />}
                            <div className={styles.infos}>
                                <div className={styles.nom}>{m.recipe?.title}</div>
                                <div className={styles.meta}>
                                    {m.recipe?.auteur ? `@${m.recipe.auteur} · ` : ''}
                                    {(m.recipe?.prepTime || 0) + (m.recipe?.cookTime || 0)} min
                                </div>
                            </div>
                        </button>
                        <button className={styles.oubli} onClick={(e) => oublier(e, m)} aria-label="Retirer">✕</button>
                    </div>
                ))}
            </div>
        </div>
    );
}
