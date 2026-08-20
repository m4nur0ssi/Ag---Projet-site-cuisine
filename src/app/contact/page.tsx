import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout/LegalLayout';
import styles from '@/components/LegalLayout/legal.module.css';
import { CONTACT_EMAIL, TAKEDOWN_DELAY } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Contact — Les Recettes Magiques',
    description:
        'Écrire à Les Recettes Magiques : suggestion de recette, question sur vos données, ou demande de retrait d’une vidéo TikTok (retrait sous 48 heures).',
};

const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;

/*
 * Une seule adresse de contact, mais des sujets pré-remplis : un créateur qui
 * demande un retrait et un lecteur qui propose une recette n'arrivent pas au
 * même endroit de la boîte.
 */
export default function ContactPage() {
    return (
        <LegalLayout title="Contact" current="/contact">
            <p>
                Une seule adresse pour tout :{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Les messages sont lus par
                l’éditeur du site, en personne.
            </p>

            <h2>Créateurs : demander le retrait d’une vidéo</h2>
            <p>
                Les vidéos affichées sur le site <strong>ne sont pas stockées sur nos serveurs</strong> :
                ce sont des liens lus par le lecteur officiel TikTok, avec mention de leur auteur.
                Si cette présence vous dérange, quelle qu’en soit la raison, il suffit de le dire.
            </p>
            <div className={styles.pledge}>
                <strong>Engagement de retrait sous {TAKEDOWN_DELAY}.</strong>
                <br />
                Envoyez le lien de la vidéo à{' '}
                <a href={mailto('Demande de retrait d’une vidéo')}>{CONTACT_EMAIL}</a> : elle est
                retirée du site dans les {TAKEDOWN_DELAY} suivant la réception, sans avoir à vous
                justifier. Précisez le lien TikTok ou l’adresse de la page du site pour aller plus
                vite.
            </div>

            <h2>Signaler un contenu illicite</h2>
            <p>
                Contrefaçon, atteinte au droit à l’image, propos déplacés dans un commentaire :
                écrivez à <a href={mailto('Signalement d’un contenu')}>{CONTACT_EMAIL}</a> en
                indiquant l’adresse de la page et la nature du problème. Les contenus manifestement
                illicites sont retirés sans délai.
            </p>

            <h2>Vos données personnelles</h2>
            <p>
                Accès, rectification, suppression de compte, retrait du consentement aux cookies :
                écrivez à <a href={mailto('Mes données personnelles')}>{CONTACT_EMAIL}</a>. Le
                détail des traitements figure dans la{' '}
                <a href="/confidentialite">politique de confidentialité</a>.
            </p>

            <h2>Proposer une recette ou signaler une erreur</h2>
            <p>
                Une recette manquante, une quantité qui cloche, une étape incompréhensible :{' '}
                <a href={mailto('Suggestion de recette')}>{CONTACT_EMAIL}</a>. Les corrections sont
                les bienvenues.
            </p>

            <h2>Qui édite le site</h2>
            <div className={styles.note}>
                <strong>Manuel Rossi</strong>, éditeur non professionnel — voir les{' '}
                <a href="/mentions-legales">mentions légales</a> pour l’identité complète et
                l’hébergeur.
            </div>
        </LegalLayout>
    );
}
