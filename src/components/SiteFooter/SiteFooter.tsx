import Link from 'next/link';
import { CONTACT_EMAIL, LEGAL_LINKS, TAKEDOWN_DELAY } from '@/lib/legal';
import styles from './siteFooter.module.css';

/*
 * Pied de page du feed d'accueil, mobile et ordinateur. Il ferme la page façon
 * Apple TV+ : sombre, discret, mais il porte tout ce que la loi exige d'avoir
 * accessible depuis l'accueil (mentions, confidentialité, CGU, contact) et la
 * phrase qui rassure les créateurs sur les vidéos.
 */
export default function SiteFooter() {
    return (
        <footer className={styles.footer}>
            <nav className={styles.links} aria-label="Informations légales">
                {LEGAL_LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className={styles.link}>
                        {l.label}
                    </Link>
                ))}
            </nav>

            <p className={styles.note}>
                Les vidéos ne sont pas hébergées ici : elles sont lues depuis TikTok, via son
                lecteur officiel, et restent la propriété de leurs auteurs. Créateur souhaitant le
                retrait de sa vidéo : un e-mail à{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className={styles.mail}>{CONTACT_EMAIL}</a>{' '}
                suffit, retrait sous {TAKEDOWN_DELAY}.
            </p>

            <p className={styles.small}>
                Recettes fournies à titre indicatif — vérifiez toujours les allergènes.
            </p>

            <p className={styles.copy}>
                © {new Date().getFullYear()} Les Recettes Magiques
            </p>
        </footer>
    );
}
