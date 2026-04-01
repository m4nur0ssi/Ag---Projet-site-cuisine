'use client';
// Vercel Deployment Sync V17.9 - Emergency Wake-Up Call
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import SplitTitle from '../SplitTitle/SplitTitle';
import FavoriteButton from '../FavoriteButton/FavoriteButton';
import styles from './Header.module.css';
import { useRouter } from 'next/navigation';

interface HeaderProps {
    title?: string;
    large?: boolean;
    showBack?: boolean;
    backUrl?: string;
    recipeId?: string;
    hideMobileIcons?: boolean;
    className?: string; // AJOUTÉ POUR FLEXIBILITÉ
    rightAction?: React.ReactNode;
    hideShoppingList?: boolean;
}

// Variables globales pour persistance session (triple-clic indestructible)
let globalClickCount = 0;
let globalClickTimer: any = null;

export default function Header({ 
    title = 'Les Recettes  Magiques', 
    large = false, 
    showBack = false, 
    backUrl, 
    recipeId, 
    hideMobileIcons = false, 
    className = '', 
    rightAction,
    hideShoppingList = false
}: HeaderProps) {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [favCount, setFavCount] = useState(0);
    const [listCount, setListCount] = useState(0);

    useEffect(() => {
        const handleSearchOpen = () => setIsSearchOpen(true);
        window.addEventListener('magic-search-open', handleSearchOpen);
        return () => window.removeEventListener('magic-search-open', handleSearchOpen);
    }, []);

    useEffect(() => {
        const updateCounts = () => {
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            setFavCount(favorites.length);

            const shopData = JSON.parse(localStorage.getItem('magic-shopping-list') || '{}');
            const totalRemaining = Object.values(shopData).reduce((acc: number, val: any) => {
                const ingredients = val.ingredients || [];
                const remaining = ingredients.filter((ing: any) =>
                    typeof ing === 'string' ? true : !ing.checked
                );
                return acc + remaining.length;
            }, 0);

            setListCount(totalRemaining);
        };

        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };

        updateCounts();
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('storage', updateCounts);
        window.addEventListener('favoritesUpdated', updateCounts);
        window.addEventListener('shoppingListUpdated', updateCounts);

        const handleFavChange = () => updateCounts();
        window.addEventListener('magic-favorite-change', handleFavChange);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('storage', updateCounts);
            window.removeEventListener('favoritesUpdated', updateCounts);
            window.removeEventListener('shoppingListUpdated', updateCounts);
            window.removeEventListener('magic-favorite-change', handleFavChange);
        };
    }, []);

    const handleMagicClick = async (e: React.MouseEvent) => {
        globalClickCount++;

        if (globalClickTimer) clearTimeout(globalClickTimer);
        globalClickTimer = setTimeout(() => {
            globalClickCount = 0;
        }, 1500);

        if (globalClickCount >= 3) {
            e.preventDefault();
            e.stopPropagation();
            globalClickCount = 0;

            setIsSyncing(true);
            try {
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ trigger_source: 'triple-click' })
                });

                const data = await res.json();

                if (res.ok) {
                    if (data.status === 'queued') {
                        alert('✨ Synchronisation lancée !\n\n🔄 GitHub Actions est en train de récupérer toutes les recettes WordPress.\n⏳ Reviens dans 2-3 minutes, le site se mettra à jour tout seul.');
                    } else if (data.status === 'success') {
                        alert('✅ Synchronisation locale terminée !\n\nRechargement en cours...');
                        setTimeout(() => window.location.reload(), 500);
                    } else {
                        alert(`ℹ️ ${data.message || 'Synchronisation terminée.'}`);
                    }
                } else {
                    const errMsg = data.error || `Erreur ${res.status}`;
                    console.error('Sync error:', errMsg);
                    alert(`❌ La synchronisation a échoué.\n\nDétail : ${errMsg}\n\nVérifie que GITHUB_PAT est configuré dans les variables Vercel.`);
                }
            } catch (err: any) {
                console.error('Sync fetch error:', err);
                alert('❌ Impossible de contacter le serveur.\n\nVérifie ta connexion internet.');
            } finally {
                setIsSyncing(false);
            }
        }
    };

    const [displayTitle, setDisplayTitle] = useState('Les Recettes Magiques');

    useEffect(() => {
        // L'alternance ne se produit que si on a scrollé (barre rétrécie)
        if (!scrolled) {
            setDisplayTitle('Les Recettes Magiques');
            return;
        }

        const interval = setInterval(() => {
            setDisplayTitle(prev => prev === 'Les Recettes Magiques' ? 'Accueil' : 'Les Recettes Magiques');
        }, 3500);
        return () => clearInterval(interval);
    }, [scrolled]);

    const handleTitleClick = (e: React.MouseEvent) => {
        // Triple-click logic for sync
        handleMagicClick(e);

        // Envoyer un signal de reset global (pour vider les filtres sur la home)
        window.dispatchEvent(new CustomEvent('magic-reset-filters'));

        // Navigation forcée vers l'accueil pour reset les filtres et l'état
        if (window.location.pathname === '/') {
            if (window.scrollY > 0) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            router.push('/');
        }
    };

    return (
        <>
            <header className={`${styles.header} ${scrolled ? styles.shrunk : ''} ${large ? styles.isLarge : ''} ${recipeId ? styles.recipeHeader : ''} ${className}`}>
                <div className={styles.container}>
                    {/* ROW 1: TITLE + SEARCH ONLY */}
                    <div className={styles.rowOne}>
                        <h1 className={`${styles.title} ${isSyncing ? styles.syncing : ''}`}>
                            <Link href="/" onClick={handleTitleClick} className={styles.titleLink}>
                                {isSyncing ? (
                                    <span className={styles.titleWhite}>🪄 Synchronisation...</span>
                                ) : (
                                    <SplitTitle text={displayTitle} large={large && !scrolled} />
                                )}
                            </Link>
                        </h1>
                        <button className={styles.pillBtnSearch} onClick={() => setIsSearchOpen(true)}>
                            Recherche
                        </button>
                    </div>
                </div>
            </header>
            <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
