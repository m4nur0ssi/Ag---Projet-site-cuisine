'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { countConsolidatedLines } from '@/lib/ingredients';
import styles from './MobileNav.module.css';

// Barre de navigation mobile (cachée en desktop via CSS).
// Bulle principale : Favoris · Liste · Accueil · Planificateur (FAB surélevé, plein écran).
// Bulle séparée à droite : Recherche (rouge).
export default function MobileNav() {
    const pathname = usePathname();
    const [cart, setCart] = useState(0);

    useEffect(() => {
        const update = () => setCart(countConsolidatedLines());
        update();
        window.addEventListener('shoppingListUpdated', update);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener('shoppingListUpdated', update);
            window.removeEventListener('storage', update);
        };
    }, []);

    const isActive = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p));
    const openPlanner = () => window.dispatchEvent(new Event('magic-open-planner'));
    const openSearch = () => window.dispatchEvent(new Event('magic-search-open'));

    return (
        <div className={styles.wrap}>
            <nav className={styles.pill}>
                <Link href="/favorites" className={`${styles.tab} ${isActive('/favorites') ? styles.active : ''}`} aria-label="Favoris">
                    <span className={styles.icon}>❤️</span>
                    <span className={styles.label}>Favoris</span>
                </Link>

                <Link href="/shopping-list" className={`${styles.tab} ${isActive('/shopping-list') ? styles.active : ''}`} aria-label="Liste de courses">
                    <span className={styles.icon}>🛒{cart > 0 && <span className={styles.badge}>{cart > 99 ? '99+' : cart}</span>}</span>
                    <span className={styles.label}>Liste</span>
                </Link>

                <Link href="/" className={`${styles.tab} ${isActive('/') ? styles.active : ''}`} aria-label="Accueil">
                    <span className={styles.icon}>🏠</span>
                    <span className={styles.label}>Accueil</span>
                </Link>

                <button className={styles.fab} onClick={openPlanner} aria-label="Planificateur">
                    <span className={styles.fabIcon}>📅</span>
                </button>
            </nav>

            <button className={styles.searchBubble} onClick={openSearch} aria-label="Recherche">
                <span className={styles.searchIcon}>🔍</span>
            </button>
        </div>
    );
}
