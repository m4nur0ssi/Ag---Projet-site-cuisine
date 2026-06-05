'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import AuthButton from '../AuthButton/AuthButton';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import FavoriteButton from '../FavoriteButton/FavoriteButton';
import styles from './Header.module.css';
import { useRouter } from 'next/navigation';

interface HeaderProps {
    title?: string;
    large?: boolean; 
    showBack?: boolean; 
    backUrl?: string;
    recipeId?: string;
    onClear?: () => void;
    showClear?: boolean;
}

// Variables globales pour persistance session (triple-clic indestructible)
let globalClickCount = 0;
let globalClickTimer: any = null;

// Truncate without cutting words
const smartTruncate = (text: string, max: number) => {
    if (text.length <= max) return text;
    const sub = text.substring(0, max);
    return sub.substring(0, Math.min(sub.length, sub.lastIndexOf(" "))) + "...";
};

export default function Header({ 
    title = 'Les Recettes Magiques', 
    large = false, 
    showBack = false, 
    backUrl, 
    recipeId,
    onClear,
    showClear = false
}: HeaderProps) {
    const displayTitle = smartTruncate(title, 32);
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [favCount, setFavCount] = useState(0);
    const [listCount, setListCount] = useState(0);

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

        updateCounts();
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('storage', updateCounts);
        window.addEventListener('favoritesUpdated', updateCounts);
        window.addEventListener('shoppingListUpdated', updateCounts);
        
        const handleFavChange = () => updateCounts();
        window.addEventListener('magic-favorite-change', handleFavChange);

        return () => {
            window.removeEventListener('scroll', handleScroll);
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

    const handleTitleClick = (e: React.MouseEvent) => {
        handleMagicClick(e);
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
            <header className={`${styles.header} ${scrolled ? styles.shrunk : ''} ${large ? styles.isLarge : ''} ${recipeId ? styles.recipeHeader : ''}`}>
                <div className={styles.container}>
                    <div className={styles.headerLeftDesktop}>
                        {showBack && (
                            <button className={styles.backBtnHeader} onClick={() => backUrl ? router.push(backUrl) : router.back()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M15 18l-6-6 6-6" />
                                </svg>
                                Retour
                            </button>
                        )}
                        <AuthButton />
                    </div>
                    {/* Connexion visible partout en haut à gauche sur mobile (bloc desktop masqué <768px) */}
                    <div className={styles.headerAuthMobile}>
                        <AuthButton />
                    </div>

                    <div className={styles.headerCenter}>
                        <h1 className={`${styles.title} ${isSyncing ? styles.syncing : ''}`}>
                            <Link href="/" onClick={handleTitleClick} className={styles.titleLink}>
                                <div className={styles.titleWell}>
                                    {isSyncing ? (
                                        <span className={styles.titleWhite}>🪄 Synchronisation...</span>
                                    ) : (
                                        <>
                                            <span className={styles.mainTitle}>{displayTitle}</span>
                                            {showClear && onClear && (
                                                <button 
                                                    className={styles.headerClearBtn}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        onClear();
                                                    }}
                                                >
                                                    Tout effacer
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </Link>
                        </h1>
                    </div>
                    
                    <div className={styles.headerRight}>
                        {isSyncing && (
                            <div className={styles.syncIndicator}>🪄</div>
                        )}
                        <ThemeToggle className={styles.themeBtn} />
                    </div>
                </div>
            </header>
            <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
