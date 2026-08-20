import Link from 'next/link';
import { LEGAL_LINKS, LEGAL_UPDATED } from '@/lib/legal';
import styles from './legal.module.css';

/*
 * Habillage commun aux pages légales (mentions, confidentialité, CGU, contact).
 * Volontairement sobre et lisible : ces pages se lisent, elles ne se parcourent
 * pas. Le pied de page renvoie vers les trois autres, on n'est jamais coincé.
 */
export default function LegalLayout({
    title,
    current,
    children,
}: {
    title: string;
    current: string;
    children: React.ReactNode;
}) {
    return (
        <main className={styles.page}>
            <Link href="/" className={styles.back}>← Retour à l’accueil</Link>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.updated}>Dernière mise à jour : {LEGAL_UPDATED}</p>

            {children}

            <nav className={styles.nav} aria-label="Autres pages légales">
                {LEGAL_LINKS.filter((l) => l.href !== current).map((l) => (
                    <Link key={l.href} href={l.href} className={styles.navLink}>
                        {l.label}
                    </Link>
                ))}
            </nav>
        </main>
    );
}
