'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './BottomNav.module.css';

const navItems = [
    { href: '/', icon: '🏠', label: 'Accueil' },
    { href: '/shopping-list', icon: '🛒', label: 'Liste' },
    { href: '/favorites', icon: '❤️', label: 'Favoris' }
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <div className={styles.navWrapper}>
            <nav className={styles.nav}>
                {navItems.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                        >
                            <span className={styles.icon}>{item.icon}</span>
                            <span className={styles.label}>{item.label}</span>
                            {isActive && <div className={styles.activeIndicator} />}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
