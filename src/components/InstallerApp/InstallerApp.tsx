'use client';

/**
 * InstallerApp — proposer d'installer le site sur l'écran d'accueil.
 *
 * Le manifeste et le service worker existent déjà : il ne manquait que l'endroit
 * où le dire. Sans cette invite, l'installation reste enfouie dans un menu du
 * navigateur que personne n'ouvre.
 *
 * Les plateformes ne se ressemblent pas :
 *   • Android et les navigateurs Chromium de bureau émettent
 *     `beforeinstallprompt`. On garde l'événement et on ouvre la vraie boîte de
 *     dialogue système : un seul geste, aucun tutoriel à lire.
 *   • iOS n'expose rien. Safari n'installe que par la main de l'utilisateur, et
 *     depuis iOS 26 le chemin a changé : la barre d'adresse du bas ne montre
 *     plus l'icône de partage, elle est passée derrière le bouton « ⋯ ». Un
 *     texte du genre « touche Partager en bas » envoie donc chercher un bouton
 *     qui n'existe plus. D'où le pas-à-pas DESSINÉ ci-dessous : chaque étape
 *     montre l'écran, avec le bouton à toucher entouré.
 *   • Safari de bureau n'a pas d'API non plus : c'est Fichier → Ajouter au Dock.
 *
 * Rien ne s'affiche si l'app est DÉJÀ installée : proposer d'installer à
 * quelqu'un qui est justement en train d'utiliser l'app installée est absurde.
 */

import React, { useEffect, useState } from 'react';
import styles from './InstallerApp.module.css';

interface InviteInstallation extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Quelle marche à suivre montrer. Décidé une fois, au montage. */
type Plateforme = 'ios' | 'android' | 'bureau-chromium' | 'bureau-safari';

/* ── Les petites scènes ────────────────────────────────────────────────────
 *
 * Dessiner l'écran vaut mieux que le décrire : « le bouton à gauche de
 * l'adresse » se lit trois fois, se voit une. Le cadre est commun, le halo
 * blanc désigne l'endroit à toucher.
 */

const Scene = ({ children, label }: { children: React.ReactNode; label: string }) => (
    <svg className={styles.scene} viewBox="0 0 200 96" fill="none" role="img" aria-label={label}>
        {children}
    </svg>
);

/**
 * Le halo qui entoure le bouton à toucher.
 *
 * Deux formes, et pas une seule : un disque posé sur une LIGNE de menu en
 * masque le texte — on entoure alors ce qu'il faut lire au lieu de le couvrir.
 * `Cible` pour les boutons ronds, `Cadre` pour les lignes et les pastilles.
 */
const Cible = ({ x, y, r = 11 }: { x: number; y: number; r?: number }) => (
    <>
        <circle cx={x} cy={y} r={r} fill="rgba(255,255,255,0.16)" />
        <circle cx={x} cy={y} r={r + 5} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" />
        <circle cx={x} cy={y} r={r + 11} stroke="#fff" strokeOpacity="0.25" strokeWidth="1.4" />
    </>
);

const Cadre = ({ x, y, w, h, r = 8 }: { x: number; y: number; w: number; h: number; r?: number }) => (
    <>
        <rect x={x} y={y} width={w} height={h} rx={r} stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" />
        <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={r + 4}
            stroke="#fff" strokeOpacity="0.22" strokeWidth="1.4" />
    </>
);

/** Étape 1 — la barre d'adresse flottante d'iOS 26, et son bouton « ⋯ ». */
const SafariBarre = () => (
    <Scene label="Barre d’adresse de Safari, en bas de l’écran">
        <rect x="26" y="4" width="148" height="60" rx="10" fill="rgba(255,255,255,0.05)" />
        <rect x="38" y="14" width="92" height="7" rx="3.5" fill="rgba(255,255,255,0.16)" />
        <rect x="38" y="28" width="124" height="7" rx="3.5" fill="rgba(255,255,255,0.10)" />
        <rect x="38" y="42" width="70" height="7" rx="3.5" fill="rgba(255,255,255,0.10)" />
        {/* La barre elle-même. */}
        <rect x="26" y="70" width="148" height="22" rx="11" fill="#1c1c1f" stroke="rgba(255,255,255,0.16)" />
        {/* Décalé vers la droite : le halo du « ⋯ » mordait sur la première lettre. */}
        <text x="107" y="84.5" textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.62)">
            lesrecettesmagiques.fr
        </text>
        <path d="M164 81h.01M168.5 81h.01M173 81h.01" stroke="rgba(255,255,255,0.5)" strokeWidth="2.4" strokeLinecap="round" />
        <Cible x={38} y={81} r={8} />
        <path d="M34 81h.01M38 81h.01M42 81h.01" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </Scene>
);

/** Étape 2 — le menu de la page, avec « Partager ». */
const SafariMenu = () => (
    <Scene label="Menu de la page, ligne Partager">
        <rect x="20" y="6" width="160" height="72" rx="14" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        {[18, 34, 50, 66].map((y, k) => (
            <g key={y}>
                <rect x="32" y={y - 4} width={k === 2 ? 62 : 44} height="8" rx="4"
                    fill={k === 2 ? '#fff' : 'rgba(255,255,255,0.16)'} />
                <rect x="150" y={y - 5} width="10" height="10" rx="2.5"
                    fill={k === 2 ? '#fff' : 'rgba(255,255,255,0.16)'} />
            </g>
        ))}
        <Cadre x={26} y={41} w={148} h={18} />
    </Scene>
);

/** Étape 3 — la feuille de partage : la liste d'actions est repliée. */
const FeuillePartage = () => (
    <Scene label="Feuille de partage, bouton pour dérouler les actions">
        <rect x="20" y="8" width="160" height="82" rx="16" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        <rect x="88" y="14" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
        {/* La rangée d'applications. */}
        {[38, 66, 94, 122, 150].map((x) => (
            <rect key={x} x={x} y="26" width="20" height="20" rx="6" fill="rgba(255,255,255,0.12)" />
        ))}
        {/* La liste d'actions, repliée, et son bouton de droite. */}
        <rect x="32" y="56" width="136" height="1" fill="rgba(255,255,255,0.12)" />
        <rect x="32" y="64" width="58" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
        <rect x="32" y="78" width="46" height="8" rx="4" fill="rgba(255,255,255,0.16)" />
        <rect x="120" y="60" width="48" height="16" rx="8" fill="#fff" />
        <text x="144" y="71.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#111">Plus</text>
        <Cadre x={118} y={58} w={52} h={20} r={10} />
    </Scene>
);

/** Étape 4 — la ligne « Sur l'écran d'accueil ». */
const LigneAccueil = () => (
    <Scene label="Ligne « Sur l’écran d’accueil » dans la liste">
        <rect x="20" y="8" width="160" height="80" rx="16" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        {[24, 44].map((y) => (
            <g key={y}>
                <rect x="32" y={y - 4} width="52" height="8" rx="4" fill="rgba(255,255,255,0.14)" />
                <rect x="150" y={y - 5} width="10" height="10" rx="2.5" fill="rgba(255,255,255,0.14)" />
            </g>
        ))}
        <rect x="28" y="56" width="144" height="24" rx="8" fill="rgba(255,255,255,0.10)" />
        <text x="40" y="71" fontSize="8" fontWeight="700" fill="#fff">Sur l’écran d’accueil</text>
        <rect x="146" y="61" width="14" height="14" rx="4" stroke="#fff" strokeWidth="1.6" />
        <path d="M153 65v6M150 68h6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />
        <Cible x={153} y={68} r={12} />
    </Scene>
);

/** Étape 5 — l'aperçu de l'icône, et le bouton « Ajouter ». */
const ApercuIcone = () => (
    <Scene label="Aperçu de l’icône et bouton Ajouter">
        <rect x="20" y="8" width="160" height="80" rx="16" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        <rect x="32" y="16" width="40" height="8" rx="4" fill="rgba(255,255,255,0.2)" />
        <rect x="128" y="13" width="40" height="16" rx="8" fill="#fff" />
        <text x="148" y="24.5" textAnchor="middle" fontSize="8" fontWeight="800" fill="#111">Ajouter</text>
        <rect x="34" y="44" width="30" height="30" rx="8" fill="url(#icone)" />
        <defs>
            <linearGradient id="icone" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FF6B4A" /><stop offset="1" stopColor="#FF2D55" />
            </linearGradient>
        </defs>
        <rect x="74" y="50" width="76" height="8" rx="4" fill="rgba(255,255,255,0.7)" />
        <rect x="74" y="64" width="52" height="7" rx="3.5" fill="rgba(255,255,255,0.22)" />
        <Cible x={148} y={21} r={19} />
    </Scene>
);

/** Android / Chromium : le menu du navigateur. */
const MenuNavigateur = ({ enHaut = true }: { enHaut?: boolean }) => (
    <Scene label="Menu du navigateur">
        <rect x="20" y={enHaut ? 6 : 30} width="160" height="60" rx="12" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        {[0, 1, 2].map((k) => (
            <rect key={k} x="32" y={(enHaut ? 18 : 42) + k * 16} width={k === 1 ? 74 : 46} height="8" rx="4"
                fill={k === 1 ? '#fff' : 'rgba(255,255,255,0.16)'} />
        ))}
        <Cadre x={26} y={(enHaut ? 14 : 38) + 16} w={148} h={16} />
        <path d="M170 12h.01M170 17h.01M170 22h.01" stroke="rgba(255,255,255,0.55)" strokeWidth="2.4" strokeLinecap="round" />
    </Scene>
);

/** Chromium de bureau : l'icône d'installation dans la barre d'adresse. */
const BarreBureau = () => (
    <Scene label="Barre d’adresse d’un navigateur de bureau">
        <rect x="14" y="18" width="172" height="26" rx="13" fill="#1c1c1f" stroke="rgba(255,255,255,0.16)" />
        <text x="34" y="35" fontSize="8" fill="rgba(255,255,255,0.6)">lesrecettesmagiques.fr</text>
        <rect x="150" y="24" width="14" height="12" rx="3" stroke="#fff" strokeWidth="1.6" />
        <path d="M157 22v8M154 27l3 3 3-3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <Cible x={157} y={30} r={12} />
        <rect x="14" y="56" width="172" height="34" rx="10" fill="rgba(255,255,255,0.05)" />
    </Scene>
);

/** Safari de bureau : la barre de menus, « Fichier ». */
const MenuFichier = () => (
    <Scene label="Barre de menus du Mac, menu Fichier">
        <rect x="10" y="8" width="180" height="16" rx="5" fill="rgba(255,255,255,0.08)" />
        {['Safari', 'Fichier', 'Édition', 'Présentation'].map((t, k) => (
            <text key={t} x={26 + k * 42} y="19.5" textAnchor="middle" fontSize="7.5"
                fontWeight={k === 1 ? 800 : 500} fill={k === 1 ? '#fff' : 'rgba(255,255,255,0.45)'}>{t}</text>
        ))}
        <rect x="46" y="28" width="104" height="56" rx="8" fill="#1c1c1f" stroke="rgba(255,255,255,0.14)" />
        {[38, 52, 66].map((y, k) => (
            <rect key={y} x="56" y={y} width={k === 1 ? 78 : 50} height="8" rx="4"
                fill={k === 1 ? '#fff' : 'rgba(255,255,255,0.16)'} />
        ))}
        <Cadre x={56} y={48} w={84} h={16} />
    </Scene>
);

interface Etape { texte: React.ReactNode; scene?: React.ReactNode }

/**
 * Le déclencheur est habillable par l'appelant : lien discret sous les boutons
 * de l'écran d'ouverture, ligne du menu latéral mobile, ou ligne de la barre
 * latérale du bureau. Une seule invite, un seul panneau — sinon les deux textes
 * divergent au premier changement.
 */
export default function InstallerApp({
    classeDeclencheur,
    contenuDeclencheur,
    avantOuverture,
}: {
    classeDeclencheur?: string;
    contenuDeclencheur?: React.ReactNode;
    avantOuverture?: () => void;
} = {}) {
    // Rendu client uniquement : le serveur ne sait ni quel appareil, ni si l'app
    // est déjà installée. Décider trop tôt ferait clignoter l'invite.
    const [pret, setPret] = useState(false);
    const [installe, setInstalle] = useState(false);
    const [ou, setOu] = useState<Plateforme>('bureau-chromium');
    const [invite, setInvite] = useState<InviteInstallation | null>(null);
    const [ouvert, setOuvert] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent || '';
        const estIOS = /iphone|ipad|ipod/i.test(ua)
            // Un iPad récent se présente comme un Mac : seul le tactile le trahit.
            || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
        // Safari de bureau : WebKit sans Chrome ni Chromium dans l'agent.
        const safariBureau = /safari/i.test(ua) && !/chrome|chromium|edg\//i.test(ua);
        const dejaLa = window.matchMedia?.('(display-mode: standalone)').matches
            || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        setOu(estIOS ? 'ios'
            : /android/i.test(ua) ? 'android'
                : safariBureau ? 'bureau-safari'
                    : 'bureau-chromium');
        setInstalle(!!dejaLa);
        setPret(true);

        const capter = (e: Event) => {
            // Sans ce `preventDefault`, Chrome affiche sa propre bannière au
            // milieu de l'écran d'accueil, par-dessus le carrousel.
            e.preventDefault();
            setInvite(e as InviteInstallation);
        };
        const pose = () => { setInstalle(true); setOuvert(false); };
        window.addEventListener('beforeinstallprompt', capter);
        window.addEventListener('appinstalled', pose);
        return () => {
            window.removeEventListener('beforeinstallprompt', capter);
            window.removeEventListener('appinstalled', pose);
        };
    }, []);

    if (!pret || installe) return null;

    const auto = ou === 'android' || ou === 'bureau-chromium';

    const installerAuto = async () => {
        if (!invite) return;
        await invite.prompt();
        const { outcome } = await invite.userChoice;
        // Chrome ne permet de rejouer un événement qu'une fois : on l'oublie.
        setInvite(null);
        if (outcome === 'accepted') setInstalle(true);
        setOuvert(false);
    };

    const titre = ou === 'ios' ? 'Ajouter à ton iPhone'
        : ou === 'android' ? 'Ajouter à ton Android'
            : 'Ajouter à ton ordinateur';

    /*
     * Les étapes. iOS 26 a déplacé le partage : la barre du bas ne porte plus
     * que l'adresse, un « ⋯ » à gauche et les onglets à droite. Le chemin est
     * donc ⋯ → Partager → (dérouler les actions) → Sur l'écran d'accueil.
     */
    const ETAPES: Record<Plateforme, Etape[]> = {
        ios: [
            { scene: <SafariBarre />, texte: <>En bas de Safari, touche le bouton <b>⋯</b> à gauche de l’adresse.</> },
            { scene: <SafariMenu />, texte: <>Dans le menu qui monte, choisis <b>Partager</b>.</> },
            { scene: <FeuillePartage />, texte: <>La liste d’actions est repliée : touche <b>Plus</b> (ou <b>En savoir plus</b>) à droite pour la dérouler.</> },
            { scene: <LigneAccueil />, texte: <>Touche <b>Sur l’écran d’accueil</b>, la ligne avec le carré et le <b>+</b>.</> },
            { scene: <ApercuIcone />, texte: <>Renomme si tu veux, puis <b>Ajouter</b>, en haut à droite. L’icône se pose sur ton écran d’accueil.</> },
        ],
        android: [
            { scene: <MenuNavigateur />, texte: <>Ouvre le menu <b>⋮</b> de Chrome, en haut à droite.</> },
            { texte: <>Choisis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).</> },
            { texte: <>Confirme avec <b>Installer</b>.</> },
        ],
        'bureau-chromium': [
            { scene: <BarreBureau />, texte: <>À droite de la barre d’adresse, clique l’icône <b>Installer</b> (un écran avec une flèche).</> },
            { texte: <>Pas d’icône ? Menu <b>⋮</b> → <b>Diffuser, enregistrer et partager</b> → <b>Installer la page en tant qu’application</b>.</> },
            { texte: <>Confirme avec <b>Installer</b> : le site s’ouvre dans sa propre fenêtre, sans barre d’adresse.</> },
        ],
        'bureau-safari': [
            { scene: <MenuFichier />, texte: <>Dans la barre de menus, ouvre <b>Fichier</b>.</> },
            { texte: <>Choisis <b>Ajouter au Dock…</b> (Safari 17 et plus, sur macOS Sonoma ou récent).</> },
            { texte: <>Nomme l’app, puis <b>Ajouter</b> : elle rejoint le Dock et le Launchpad.</> },
        ],
    };

    const etapes = ETAPES[ou];

    return (
        <>
            <button
                type="button"
                className={classeDeclencheur || styles.lien}
                onClick={(e) => {
                    e.stopPropagation();
                    avantOuverture?.();
                    // Quand le navigateur sait le faire lui-même, le tutoriel est
                    // une politesse inutile : on ouvre directement sa fenêtre.
                    if (auto && invite) { installerAuto(); return; }
                    setOuvert(true);
                }}
            >
                {contenuDeclencheur || 'Installer l’application'}
            </button>

            {ouvert && (
                <div className={styles.voile} onClick={() => setOuvert(false)} role="presentation">
                    <div className={styles.panneau} onClick={(e) => e.stopPropagation()}
                        role="dialog" aria-modal="true" aria-label={titre}>
                        <p className={styles.kicker}>Écran d’accueil</p>
                        <h2 className={styles.titre}>{titre}</h2>
                        <p className={styles.chapeau}>
                            L’app s’ouvre en plein écran, sans barre d’adresse, et garde tes recettes
                            sous la main.
                        </p>

                        <ol className={styles.etapes}>
                            {etapes.map((e, k) => (
                                <li className={styles.etape} key={k}>
                                    <div className={styles.ligne}>
                                        <span className={styles.num}>{k + 1}</span>
                                        <span>{e.texte}</span>
                                    </div>
                                    {e.scene}
                                </li>
                            ))}
                        </ol>

                        {ou === 'ios' && (
                            <p className={styles.note}>
                                Depuis <b>Safari</b> uniquement : Chrome et Firefox sur iPhone n’ont pas le
                                droit d’installer une app. Si ta barre d’adresse est en haut de l’écran, le
                                bouton <b>⋯</b> est à sa droite — le reste ne change pas.
                            </p>
                        )}

                        <div className={styles.actions}>
                            {auto && invite && (
                                <button type="button" className={styles.principal} onClick={installerAuto}>
                                    Installer maintenant
                                </button>
                            )}
                            <button type="button" className={styles.secondaire} onClick={() => setOuvert(false)}>
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
