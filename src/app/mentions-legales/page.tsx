import type { Metadata } from 'next';
import LegalLayout from '@/components/LegalLayout/LegalLayout';
import styles from '@/components/LegalLayout/legal.module.css';
import { CONTACT_EMAIL, TAKEDOWN_DELAY } from '@/lib/legal';

export const metadata: Metadata = {
    title: 'Mentions légales — Les Recettes Magiques',
    description:
        'Éditeur, hébergeur, propriété intellectuelle et procédure de retrait des contenus du site Les Recettes Magiques.',
};

/*
 * Mentions légales — article 6 III de la LCEN.
 * L'éditeur est un particulier non professionnel : la loi l'autorise à ne pas
 * publier son adresse postale, à condition d'indiquer l'hébergeur, qui la
 * détient. Si le site devient une activité professionnelle, il faudra ajouter
 * l'adresse, le SIRET et, le cas échéant, la TVA.
 */
export default function MentionsLegalesPage() {
    return (
        <LegalLayout title="Mentions légales" current="/mentions-legales">
            <p>
                Conformément à l’article 6 III de la loi n° 2004-575 du 21 juin 2004 pour la
                confiance dans l’économie numérique, voici les informations relatives à l’éditeur et
                à l’hébergeur du site <strong>Les Recettes Magiques</strong>.
            </p>

            <h2>1. Éditeur du site</h2>
            <div className={styles.note}>
                <strong>Manuel Rossi</strong>, éditeur non professionnel, agissant à titre
                personnel.<br />
                Directeur de la publication : Manuel Rossi.<br />
                Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </div>
            <p>
                Le site est édité à titre non professionnel et ne donne lieu à aucune vente. En
                application de l’article 6 III 2 de la LCEN, l’éditeur, personne physique non
                professionnelle, ne publie pas son adresse postale ; celle-ci est détenue par
                l’hébergeur, qui la communiquera aux autorités judiciaires sur réquisition.
            </p>

            <h2>2. Hébergeur</h2>
            <p>
                <strong>Vercel Inc.</strong> — 440 N Barranca Ave #4133, Covina, CA 91723,
                États-Unis — <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a>.
            </p>
            <p>
                Les données de compte et la base de données sont hébergées par{' '}
                <strong>Supabase Inc.</strong> (région Europe), et les recettes proviennent d’un
                back-office WordPress géré par l’éditeur.
            </p>

            <h2>3. Propriété intellectuelle</h2>
            <p>
                La structure du site, son interface, ses textes de présentation et ses éléments
                graphiques sont la propriété de l’éditeur. Toute reproduction ou représentation,
                totale ou partielle, sans autorisation écrite, est interdite.
            </p>
            <p>
                Les recettes, photographies et vidéos issues de créateurs tiers restent la propriété
                de leurs auteurs respectifs, cités sur chaque fiche.
            </p>

            <h2>4. Vidéos TikTok et créateurs</h2>
            <p>
                <strong>Aucune vidéo n’est stockée sur les serveurs du site.</strong> Les vidéos
                sont affichées au moyen du lecteur officiel intégré de TikTok : le fichier reste
                hébergé par TikTok, qui en assure seul la diffusion. Le site ne fait que pointer
                vers la publication d’origine, avec mention du créateur et lien vers son compte.
                Aucune copie, aucun téléchargement, aucune ré-hébergement n’est effectué.
            </p>
            <p>
                Cette intégration s’effectue dans le respect des conditions d’utilisation de TikTok,
                qui prévoient l’incorporation publique des vidéos par ce lecteur.
            </p>
            <div className={styles.pledge}>
                <strong>Vous êtes créateur et vous ne souhaitez pas apparaître ici ?</strong>
                <br />
                Écrivez à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> en indiquant le
                lien de la vidéo concernée. Elle sera retirée du site dans un délai maximal de{' '}
                <strong>{TAKEDOWN_DELAY}</strong> après réception du message, sans discussion ni
                justification à fournir.
            </div>

            <h2>5. Signalement d’un contenu illicite</h2>
            <p>
                Toute personne peut signaler un contenu qu’elle estime illicite (contrefaçon,
                atteinte au droit à l’image, propos haineux, etc.) à l’adresse{' '}
                <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Pour permettre un
                traitement rapide, le signalement gagne à préciser l’URL concernée, la nature du
                problème et, si possible, le fondement invoqué. Les contenus manifestement illicites
                sont retirés sans délai.
            </p>

            <h2>6. Liens vers des sites tiers</h2>
            <p>
                Le site renvoie vers des services extérieurs (TikTok, enseignes de courses en ligne,
                sites de créateurs). L’éditeur n’exerce aucun contrôle sur ces sites et décline
                toute responsabilité quant à leur contenu et à leurs pratiques en matière de
                données.
            </p>

            <h2>7. Responsabilité</h2>
            <p>
                Les recettes sont publiées à titre informatif. L’éditeur ne garantit ni le résultat
                culinaire, ni l’exactitude des durées, quantités et valeurs nutritionnelles
                indiquées, dont certaines sont estimées automatiquement. Il appartient à chacun de
                vérifier la <strong>présence d’allergènes</strong> et la compatibilité des
                ingrédients avec son état de santé ou son régime alimentaire. En cas de doute
                médical, consultez un professionnel de santé.
            </p>
            <p>
                L’éditeur s’efforce d’assurer la disponibilité du site sans pouvoir la garantir, et
                peut l’interrompre pour maintenance ou évolution.
            </p>

            <h2>8. Droit applicable</h2>
            <p>
                Les présentes mentions sont soumises au droit français. En cas de litige et à défaut
                de résolution amiable, les tribunaux français sont compétents.
            </p>
        </LegalLayout>
    );
}
