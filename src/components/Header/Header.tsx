'use client';
// Vercel Deployment Sync V18.0 - Sync Button Edition
import { useState, useEffect } from 'react';
import Link from 'next/link';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import SplitTitle from '../SplitTitle/SplitTitle';
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
}

// Triple-clic global (power users)
let globalClickCount = 0;
let globalClickTimer: any = null;

// Fonction de sync partagée — appelle /api/sync
async function triggerSync(source = 'button'): Promise<{ ok: boolean; message: string }> {
    const res = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger_source: source })
    });
    const data = await res.json();
    if (res.ok) {
        return { ok: true, message: data.message || 'Synchronisation lancée !' };
    }
    return { ok: false, message: data.error || `Erreur ${res.status}` };
}

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
    const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');

    useEffect(() => {
        const handleSearchOpen = () => setIsSearchOpen(true);
        window.addEventListener('magic-search-open', handleSearchOpen);
        return () => window.removeEventListener('magic-search-open', handleSearchOpen);
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
        window.dispatchEvent(new CustomEvent('magic-reset-filters'));
        if (window.location.pathname === '/') {
            if (window.scrollY > 0) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        } else {
            router.push('/');
        }
    };

    const syncLabel = isSyncing ? 'Sync...' 
        : syncStatus === 'ok' ? 'Syncé ✓' 
        : syncStatus === 'error' ? 'Erreur ⚠️' 
        : 'Sync';

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
                        <button className={styles.pillBtnSearch} onClick={() => setIsSearchOpen(true)}>
                            Recherche
                        </button>
                    </div>
                </div>
            </header>

            {/* Bouton Sync flottant — visible en bas à droite, au-dessus de la BottomNav */}
            <button
                className={`${styles.syncBtn} ${isSyncing ? styles.isSyncing : ''}`}
                onClick={() => handleSync('button')}
                disabled={isSyncing}
                title="Synchroniser toutes les recettes WordPress → Netlify"
                aria-label="Synchronisation Netlify"
            >
                <span className={`${styles.syncIcon} ${isSyncing ? styles.spinning : ''}`}>
                    ↻
                </span>
                {syncLabel}
            </button>

            <SpotlightSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
        </>
    );
}
