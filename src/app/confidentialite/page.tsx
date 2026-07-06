import type { Metadata } from 'next';
import styles from './confidentialite.module.css';

export const metadata: Metadata = {
    title: 'Politique de confidentialité — Les Recettes Magiques',
    description: 'Comment nous traitons vos données personnelles et vos cookies, conformément au RGPD.',
};

/*
 * Politique de confidentialité (RGPD / CNIL).
 * À COMPLÉTER par l'éditeur avant mise en production :
 *  - Identité de l'éditeur (nom / raison sociale, statut, adresse)
 *  - Hébergeur (Vercel : Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA)
 *  - Nom exact de l'outil de mesure d'audience une fois installé (ex : Google Analytics 4)
 */
export default function ConfidentialitePage() {
    return (
        <main className={styles.page}>
            <h1 className={styles.title}>Politique de confidentialité</h1>
            <p className={styles.updated}>Dernière mise à jour : 6 juillet 2026</p>

            <p>
                La présente politique explique quelles données personnelles sont collectées sur le
                site <strong>Les Recettes Magiques</strong>, dans quel but, et quels sont vos droits.
                Nous appliquons le Règlement général sur la protection des données (RGPD) et les
                recommandations de la CNIL.
            </p>

            <div className={styles.note}>
                Éditeur du site : <strong>[à compléter — nom / adresse]</strong>. Hébergeur :
                Vercel Inc. Contact : <a href="mailto:m4nu.r0ssi@gmail.com">m4nu.r0ssi@gmail.com</a>.
            </div>

            <h2>1. Données que nous collectons</h2>
            <ul>
                <li>
                    <strong>Compte utilisateur</strong> (facultatif) : votre adresse e-mail, gérée via
                    notre prestataire d’authentification Supabase, lorsque vous créez un compte pour
                    enregistrer vos favoris et vos menus.
                </li>
                <li>
                    <strong>Préférences locales</strong> : favoris, liste de courses et planning sont
                    stockés dans le stockage local (localStorage) de votre navigateur, sur votre
                    appareil. Ces données ne sont pas transmises tant que vous n’avez pas de compte.
                </li>
                <li>
                    <strong>Mesure d’audience et publicité</strong> : uniquement si vous y consentez
                    via le bandeau cookies (voir section 4).
                </li>
            </ul>

            <h2>2. Finalités et base légale</h2>
            <ul>
                <li>Fournir le service (favoris, menus, liste de courses) — exécution du service / intérêt légitime.</li>
                <li>Créer et sécuriser votre compte — exécution du contrat.</li>
                <li>Mesurer l’audience et, à terme, afficher de la publicité — votre consentement.</li>
            </ul>

            <h2>3. Destinataires et sous-traitants</h2>
            <p>
                Nous ne vendons pas vos données. Elles peuvent être traitées par nos sous-traitants
                techniques : <strong>Supabase</strong> (authentification et base de données) et
                <strong> Vercel</strong> (hébergement). Ces prestataires agissent selon nos
                instructions et présentent des garanties conformes au RGPD.
            </p>

            <h2>4. Cookies et traceurs</h2>
            <p>
                Aucun cookie de mesure d’audience ou de publicité n’est déposé avant votre
                consentement. Par défaut, le mode consentement (Google Consent Mode v2) est réglé
                sur « refusé ». Le bandeau vous permet d’<strong>accepter</strong> ou de
                <strong> refuser</strong> au même niveau, sans conséquence sur l’accès au site.
                Votre choix est conservé dans votre navigateur et peut être modifié à tout moment en
                effaçant les données du site.
            </p>

            <h2>5. Durée de conservation</h2>
            <ul>
                <li>Données de compte : tant que le compte existe, puis supprimées sur demande.</li>
                <li>Préférences locales : jusqu’à ce que vous les effaciez dans votre navigateur.</li>
                <li>Consentement cookies : jusqu’à 6 mois, puis le bandeau réapparaît.</li>
            </ul>

            <h2>6. Vos droits</h2>
            <p>
                Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation,
                d’opposition et de portabilité de vos données, ainsi que du droit de retirer votre
                consentement à tout moment. Pour les exercer, écrivez-nous à{' '}
                <a href="mailto:m4nu.r0ssi@gmail.com">m4nu.r0ssi@gmail.com</a>. Vous pouvez aussi
                introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
            </p>

            <h2>7. Contenus TikTok et créateurs</h2>
            <p>
                Certaines recettes intègrent des vidéos via le lecteur officiel TikTok. La lecture et
                l’attribution reviennent à leurs auteurs. Si vous êtes l’auteur d’une vidéo et
                souhaitez son retrait, contactez-nous à l’adresse ci-dessus.
            </p>

            <h2>8. Modifications</h2>
            <p>
                Cette politique peut évoluer. La date de dernière mise à jour figure en haut de page.
            </p>
        </main>
    );
}
