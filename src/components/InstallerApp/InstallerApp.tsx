'use client';

/**
 * InstallerApp — proposer d'installer le site sur l'écran d'accueil.
 *
 * Le manifeste et le service worker existent déjà : il ne manquait que l'endroit
 * où le dire. Sans cette invite, l'installation reste enfouie dans un menu du
 * navigateur que personne n'ouvre.
 *
 * Les deux plateformes ne se ressemblent pas :
 *   • Android (Chrome) émet `beforeinstallprompt`. On garde l'événement et on
 *     ouvre la vraie boîte de dialogue système : un seul geste.
 *   • iOS ne l'émet pas et n'expose aucune API. Safari n'installe que par
 *     « Partager → Sur l'écran d'accueil ». Il n'y a rien d'autre à faire que
 *     de montrer le chemin — d'où les étapes illustrées.
 *
 * Rien ne s'affiche si l'app est DÉJÀ installée : proposer d'installer à
 * quelqu'un qui est justement en train d'utiliser l'app installée est absurde.
 */

import { useEffect, useState } from 'react';
import styles from './InstallerApp.module.css';

interface InviteInstallation extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Partage = () => (
    <svg className={styles.pas} width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 15V3m-4 4 4-4 4 4" />
        <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
    </svg>
);

const Ajouter = () => (
    <svg className={styles.pas} width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M12 8v8M8 12h8" />
    </svg>
);

const Menu = () => (
    <svg className={styles.pas} width="17" height="17" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <path d="M12 5h.01M12 12h.01M12 19h.01" />
    </svg>
);

export default function InstallerApp() {
    // Rendu client uniquement : le serveur ne sait ni quel appareil, ni si l'app
    // est déjà installée. Décider trop tôt ferait clignoter l'invite.
    const [pret, setPret] = useState(false);
    const [installe, setInstalle] = useState(false);
    const [ios, setIos] = useState(false);
    const [androide, setAndroide] = useState(false);
    const [invite, setInvite] = useState<InviteInstallation | null>(null);
    const [ouvert, setOuvert] = useState(false);

    useEffect(() => {
        const ua = navigator.userAgent || '';
        const estIOS = /iphone|ipad|ipod/i.test(ua)
            // Un iPad récent se présente comme un Mac : seul le tactile le trahit.
            || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
        const dejaLa = window.matchMedia?.('(display-mode: standalone)').matches
            || (window.navigator as unknown as { standalone?: boolean }).standalone === true;

        setIos(estIOS);
        setAndroide(/android/i.test(ua));
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
    // Sur téléphone, on propose TOUJOURS : `beforeinstallprompt` n'arrive pas
    // partout (Firefox, Samsung Internet, ou simplement un service worker pas
    // encore prêt), alors que le chemin manuel, lui, marche toujours. Ailleurs
    // — un ordinateur — on ne parle que si le navigateur s'est annoncé.
    if (!ios && !androide && !invite) return null;

    const installerAndroid = async () => {
        if (!invite) return;
        await invite.prompt();
        const { outcome } = await invite.userChoice;
        // Chrome ne permet de rejouer un événement qu'une fois : on l'oublie.
        setInvite(null);
        if (outcome === 'accepted') setInstalle(true);
        setOuvert(false);
    };

    return (
        <>
            <button
                type="button"
                className={styles.lien}
                onClick={(e) => {
                    e.stopPropagation();
                    if (!ios && invite) { installerAndroid(); return; }
                    setOuvert(true);
                }}
            >
                Installer l’application
            </button>

            {ouvert && (
                <div className={styles.voile} onClick={() => setOuvert(false)} role="presentation">
                    <div className={styles.panneau} onClick={(e) => e.stopPropagation()}>
                        <p className={styles.kicker}>Écran d’accueil</p>
                        <h2 className={styles.titre}>
                            {ios ? 'Ajouter à ton iPhone' : 'Ajouter à ton Android'}
                        </h2>
                        <p className={styles.chapeau}>
                            L’app s’ouvre en plein écran, sans barre d’adresse, et garde tes recettes
                            sous la main.
                        </p>

                        <ol className={styles.etapes}>
                            {ios ? (
                                <>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>1</span>
                                        <span>Touche <Partage /> <b>Partager</b>, en bas de Safari.</span>
                                    </li>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>2</span>
                                        <span>Fais défiler, puis choisis <Ajouter /> <b>Sur l’écran d’accueil</b>.</span>
                                    </li>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>3</span>
                                        <span>Touche <b>Ajouter</b>, en haut à droite.</span>
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>1</span>
                                        <span>Ouvre le menu <Menu /> de Chrome, en haut à droite.</span>
                                    </li>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>2</span>
                                        <span>Choisis <b>Installer l’application</b> (ou <b>Ajouter à l’écran d’accueil</b>).</span>
                                    </li>
                                    <li className={styles.etape}>
                                        <span className={styles.num}>3</span>
                                        <span>Confirme avec <b>Installer</b>.</span>
                                    </li>
                                </>
                            )}
                        </ol>

                        {ios && (
                            <p className={styles.note}>
                                Depuis Safari uniquement : Chrome et Firefox sur iPhone n’ont pas le
                                droit d’installer une app.
                            </p>
                        )}

                        <div className={styles.actions}>
                            {!ios && invite && (
                                <button type="button" className={styles.principal} onClick={installerAndroid}>
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
