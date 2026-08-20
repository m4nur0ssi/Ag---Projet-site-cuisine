import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout/LegalLayout';
import styles from '@/components/LegalLayout/legal.module.css';
import { CONTACT_EMAIL, TAKEDOWN_DELAY } from '@/lib/legal';

export const metadata: Metadata = {
    title: "Conditions générales d'utilisation — Les Recettes Magiques",
    description:
        "Règles d'utilisation du site Les Recettes Magiques : compte, contenus publiés, favoris, listes de courses et responsabilités.",
};

/*
 * CGU d'un site gratuit, sans vente ni abonnement : pas de conditions de vente,
 * pas de médiateur de la consommation. Si une boutique ou un abonnement
 * apparaît un jour, il faudra ajouter des CGV distinctes et le droit de
 * rétractation.
 */
export default function CguPage() {
    return (
        <LegalLayout title="Conditions générales d’utilisation" current="/cgu">
            <p>
                Les présentes conditions régissent l’utilisation du site{' '}
                <strong>Les Recettes Magiques</strong>. Naviguer sur le site vaut acceptation de ces
                conditions.
            </p>

            <h2>1. Objet du service</h2>
            <p>
                Le site propose une sélection de recettes de cuisine, accompagnées de vidéos de
                créateurs diffusées via le lecteur TikTok, ainsi que des outils gratuits : favoris,
                planificateur de menus, liste de courses, minuteurs et convertisseur de mesures.
            </p>

            <h2>2. Accès et gratuité</h2>
            <p>
                L’accès au site est gratuit, hors coût de connexion. Certaines fonctions
                (synchronisation des favoris, menus et listes entre appareils) nécessitent un
                compte. Aucune fonction n’est payante et aucun paiement n’est collecté.
            </p>

            <h2>3. Compte utilisateur</h2>
            <ul>
                <li>La création d’un compte se fait par adresse e-mail, via le prestataire Supabase.</li>
                <li>Vous êtes responsable de la confidentialité de vos identifiants.</li>
                <li>
                    Vous pouvez demander la suppression de votre compte et des données associées à
                    tout moment en écrivant à{' '}
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                </li>
            </ul>

            <h2>4. Contenus que vous publiez</h2>
            <p>
                Notes, commentaires et suggestions de recettes restent sous votre responsabilité. En
                les publiant, vous garantissez qu’ils sont les vôtres et qu’ils ne portent atteinte
                à aucun droit de tiers.
            </p>
            <p>Sont interdits, et supprimés sans préavis :</p>
            <ul>
                <li>les propos injurieux, haineux, discriminatoires ou diffamatoires ;</li>
                <li>les contenus contrefaisants ou portant atteinte au droit à l’image ;</li>
                <li>le démarchage, le spam et les liens publicitaires ;</li>
                <li>toute tentative de nuire au fonctionnement du site.</li>
            </ul>
            <p>
                L’éditeur peut supprimer un contenu et suspendre un compte en cas de manquement,
                sans que cela ouvre droit à indemnité.
            </p>

            <h2>5. Vidéos et recettes de créateurs</h2>
            <p>
                Les vidéos ne sont pas hébergées par le site : elles sont lues depuis TikTok via son
                lecteur officiel, et restent la propriété de leurs auteurs, systématiquement crédités.
            </p>
            <div className={styles.pledge}>
                Un créateur qui souhaite le retrait de sa vidéo écrit à{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : le retrait intervient sous{' '}
                <strong>{TAKEDOWN_DELAY}</strong> maximum.
            </div>

            <h2>6. Utilisation personnelle</h2>
            <p>
                Le site est destiné à un usage personnel et non commercial. L’extraction
                systématique du contenu (aspiration, moissonnage automatisé, reconstitution de la
                base de recettes) est interdite.
            </p>

            <h2>7. Informations culinaires et santé</h2>
            <p>
                Les temps de préparation, quantités, niveaux de difficulté et estimations
                nutritionnelles sont indicatifs, parfois calculés automatiquement à partir des
                étapes. Ils ne constituent ni un conseil diététique, ni un avis médical. La
                vérification des <strong>allergènes</strong> incombe à l’utilisateur.
            </p>

            <h2>8. Disponibilité et évolution</h2>
            <p>
                Le service peut être modifié, suspendu ou interrompu à tout moment, notamment pour
                maintenance. Les présentes conditions peuvent évoluer ; la version applicable est
                celle publiée sur cette page, dont la date de mise à jour figure en haut.
            </p>

            <h2>9. Données personnelles</h2>
            <p>
                Le traitement des données est décrit dans la{' '}
                <a href="/confidentialite">politique de confidentialité</a>.
            </p>

            <h2>10. Droit applicable</h2>
            <p>
                Les présentes conditions sont soumises au droit français. À défaut d’accord amiable,
                le litige relève des tribunaux français compétents.
            </p>
        </LegalLayout>
    );
}
