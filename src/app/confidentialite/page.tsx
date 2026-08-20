import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout/LegalLayout';
import styles from '@/components/LegalLayout/legal.module.css';
import { CONTACT_EMAIL, TAKEDOWN_DELAY } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Politique de confidentialité — Les Recettes Magiques',
    description: 'Comment nous traitons vos données personnelles et vos cookies, conformément au RGPD.',
};

/*
 * Politique de confidentialité (RGPD / CNIL).
 * Le nom de l'outil de mesure d'audience est à préciser ici le jour où il sera
 * réellement installé (aujourd'hui : Google Consent Mode v2 réglé sur refus).
 */
export default function ConfidentialitePage() {
    return (
        <LegalLayout title="Politique de confidentialité" current="/confidentialite">
            <p>
                La présente politique explique quelles données personnelles sont collectées sur le
                site <strong>Les Recettes Magiques</strong>, dans quel but, et quels sont vos droits.
                Nous appliquons le Règlement général sur la protection des données (RGPD) et les
                recommandations de la CNIL.
            </p>

            <div className={styles.note}>
                Responsable de traitement : <strong>Manuel Rossi</strong> (voir les{' '}
                <a href="/mentions-legales">mentions légales</a>). Hébergeur : Vercel Inc. Contact :{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
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
                    <strong>Contenus que vous publiez</strong> : notes et commentaires laissés sur
                    les recettes, associés à votre compte.
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
            <p>
                La lecture d’une vidéo TikTok intégrée peut amener TikTok à déposer ses propres
                traceurs, sous sa seule responsabilité et selon sa politique de confidentialité.
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
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Vous pouvez aussi
                introduire une réclamation auprès de la CNIL (<a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>).
            </p>

            <h2>7. Contenus TikTok et créateurs</h2>
            <p>
                Certaines recettes intègrent des vidéos via le lecteur officiel TikTok :{' '}
                <strong>aucune vidéo n’est stockée sur nos serveurs</strong>, seul un lien vers la
                publication d’origine est utilisé. La lecture et l’attribution reviennent à leurs
                auteurs.
            </p>
            <div className={styles.pledge}>
                Auteur d’une vidéo qui souhaite son retrait : écrivez à{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, le retrait est effectué
                sous <strong>{TAKEDOWN_DELAY}</strong>.
            </div>

            <h2>8. Modifications</h2>
            <p>
                Cette politique peut évoluer. La date de dernière mise à jour figure en haut de page.
            </p>
        </LegalLayout>
    );
}
