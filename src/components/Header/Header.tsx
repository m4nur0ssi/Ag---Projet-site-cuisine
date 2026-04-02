'use client';
// Vercel Deployment Sync V18.0 - Sync Button Edition
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import SplitTitle from '../SplitTitle/SplitTitle';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import { triggerSync } from '@/services/syncService';
import styles from './Header.module.css';
import { useRouter } from 'next/navigation';

interface HeaderProps {
    title?: string;
    large?: boolean;
    showBack?: boolean;
    backUrl?: string;
    recipeId?: string;
    hideMobileIcons?: boolean;
    className?: string;
    rightAction?: React.ReactNode;
    hideShoppingList?: boolean;
    hideHeart?: boolean;
}

// Triple-clic global (power users)
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
    hideShoppingList = false,
    hideHeart = false
}: HeaderProps) {
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

    const [favoriteCount, setFavoriteCount] = useState(0);

    useEffect(() => {
        const handleSearchOpen = () => setIsSearchOpen(true);
        window.addEventListener('magic-search-open', handleSearchOpen);

        const updateFavoriteCount = () => {
            const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
            setFavoriteCount(favorites.length);
        };
        updateFavoriteCount();
        window.addEventListener('storage', updateFavoriteCount);
        window.addEventListener('magic-favorite-change', updateFavoriteCount);

        const handleToast = (e: any) => {
            setToast({ message: e.detail || 'Opération réussie !', show: true });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
        };
        window.addEventListener('magic-toast-notify', handleToast);

        return () => {
            window.removeEventListener('magic-search-open', handleSearchOpen);
            window.removeEventListener('storage', updateFavoriteCount);
            window.removeEventListener('magic-favorite-change', updateFavoriteCount);
            window.removeEventListener('magic-toast-notify', handleToast);
        };
    }, []);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsSearchOpen(true);
            }
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Fonction principale de sync (bouton visible + triple-clic)
    const handleSync = async (source = 'button') => {
        if (isSyncing) return;
        setIsSyncing(true);
        setSyncStatus('idle');
        try {
            const result = await triggerSync(source);
            if (result.ok) {
                setSyncStatus('ok');
                alert('✨ Synchronisation lancée !\n\n🔄 GitHub Actions met à jour toutes les recettes WordPress.\n⏳ Reviens dans 2-3 minutes, le site se mettra à jour tout seul.');
            } else {
                setSyncStatus('error');
                alert(`❌ La synchronisation a échoué.\n\nDétail : ${result.message}\n\nVérifie que GITHUB_PAT est configuré dans les variables Vercel.`);
            }
        } catch (err: any) {
            setSyncStatus('error');
            alert('❌ Impossible de contacter le serveur.\n\nVérifie ta connexion internet.');
        } finally {
            setIsSyncing(false);
            setTimeout(() => setSyncStatus('idle'), 3000);
        }
    };

    // Triple-clic sur le titre (power user)
    const handleMagicClick = (e: React.MouseEvent) => {
        globalClickCount++;
        if (globalClickTimer) clearTimeout(globalClickTimer);
        globalClickTimer = setTimeout(() => { globalClickCount = 0; }, 1500);
        if (globalClickCount >= 3) {
            e.preventDefault();
            e.stopPropagation();
            globalClickCount = 0;
            handleSync('triple-click');
        }
    };

    const [displayTitle, setDisplayTitle] = useState('Les Recettes Magiques');

    useEffect(() => {
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
        handleMagicClick(e);
        if (window.location.pathname === '/') {
            window.dispatchEvent(new CustomEvent('magic-reset-filters'));
            if (window.scrollY > 0) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            e.preventDefault();
            window.location.href = '/';
        }
    };

    return (
        <>
            <header className={`${styles.header} ${scrolled ? styles.shrunk : ''} ${large ? styles.isLarge : ''} ${recipeId ? styles.recipeHeader : ''} ${className}`}>
                <div className={styles.container}>
                    {/* ROW 1: TITLE + SEARCH */}
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
                        <div className={styles.navActionsSide}>
                            <div className={`${styles.searchPillWrapper} ${scrolled ? styles.isExpanded : ''}`}>
                                {!scrolled ? (
                                    <button className={styles.pillBtnSearch} onClick={() => setIsSearchOpen(true)}>
                                        Recherche
                                    </button>
                                ) : (
                                    <div className={styles.expandedUtils}>
                                        {rightAction ? rightAction : (
                                            <div className={styles.toolsGroup}>
                                                <button 
                                                    className={styles.toolBtn}
                                                    onClick={() => setIsSearchOpen(true)}
                                                >
                                                    🔍
                                                </button>
                                                <Link href="/favorites" className={`${styles.toolBtn} ${favoriteCount > 0 ? styles.hasFavorite : ''}`}>
                                                    {favoriteCount > 0 ? '❤️' : '🤍'}
                                                    {favoriteCount > 0 && (
                                                        <span className={styles.navFavBadge}>{favoriteCount}</span>
                                                    )}
                                                </Link>
                                                <Link href="/shopping-list" className={styles.toolBtn}>
                                                    🛒
                                                </Link>

                                                <ThemeToggle className={styles.themeToggleWrapper} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* NOTIFICATION TOAST (Dynamic Island style) */}
                <div className={`${styles.toastOverlay} ${toast.show ? styles.toastActive : ''}`}>
                    <div className={styles.toastCapsule}>
                        <span className={styles.toastEmoji}>✨</span>
                        <span className={styles.toastMessage}>{toast.message}</span>
                    </div>
                </div>
            </header>

            <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
