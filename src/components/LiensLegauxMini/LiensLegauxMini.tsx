import Link from 'next/link';
import styles from './LiensLegauxMini.module.css';

/*
 * Les liens légaux, en petit, au pied du panneau du compte.
 *
 * Le pied de page qui les porte n'existe que sur les deux accueils ; les
 * autres écrans n'en avaient aucun. Le bouton du compte, lui, est monté dans
 * le tiroir de navigation, les en-têtes et le planificateur mobile : c'est là
 * qu'ils deviennent accessibles, sans rien ajouter aux mises en page.
 */
const LIENS = [
    { href: '/confidentialite', label: 'Confidentialité' },
    { href: '/mentions-legales', label: 'Mentions légales' },
    { href: '/cgu', label: 'CGU' },
];

export default function LiensLegauxMini() {
    return (
        <nav className={styles.liens} aria-label="Informations légales">
            {LIENS.map((l, i) => (
                <span key={l.href}>
                    {i > 0 && <span className={styles.point} aria-hidden="true"> · </span>}
                    <Link href={l.href} className={styles.lien}>{l.label}</Link>
                </span>
            ))}
        </nav>
    );
}
