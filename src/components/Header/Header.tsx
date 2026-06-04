'use client';
// Vercel Deployment Sync V18.0 - Sync Button Edition
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import SpotlightSearch from '../SpotlightSearch/SpotlightSearch';
import SplitTitle from '../SplitTitle/SplitTitle';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import WeekPlanner from '../WeekPlanner/WeekPlanner';
import AuthButton from '../AuthButton/AuthButton';
import PlannerTooltip from './PlannerTooltip';
import PlannerIcon from '../PlannerIcon/PlannerIcon';
import { triggerSync } from '@/services/syncService';
import { supabase } from '@/lib/supabase';
import { countConsolidatedLines } from '@/lib/ingredients';
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
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'ok' | 'error'>('idle');
    const [toast, setToast] = useState<{ message: string; show: boolean }>({ message: '', show: false });

    const [favoriteCount, setFavoriteCount] = useState(0);
    const [shoppingCount, setShoppingCount] = useState(0);
    const [authUser, setAuthUser] = useState<any>(null);
    const [todayMeals, setTodayMeals] = useState<{ midi?: any; soir?: any }>({});
    const [showPlannerTooltip, setShowPlannerTooltip] = useState(false);
    const plannerBtnRef = useRef<HTMLButtonElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);
    const plannerHideTimer = useRef<any>(null);

    useEffect(() => {
        // keep = survol d'une carte : annule la fermeture ET ré-affiche (au cas où le
        // timer aurait déjà masqué pendant le trajet souris vers la carte de gauche).
        const keep = () => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(true); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: true } })); };
        const leave = () => { plannerHideTimer.current = setTimeout(() => { setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); }, 450); };
        const forceHide = () => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); };
        window.addEventListener('closePlannerTooltip', forceHide);
        window.addEventListener('planner-tooltip-keep', keep);
        window.addEventListener('planner-tooltip-leave', leave);
        return () => { window.removeEventListener('planner-tooltip-keep', keep); window.removeEventListener('planner-tooltip-leave', leave); window.removeEventListener('closePlannerTooltip', forceHide); };
    }, []);

    useEffect(() => {
        console.log('[Header] auth useEffect running');
        const loadTodayMeals = async (userId: string) => {
            const days = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
            const today = days[new Date().getDay()];
            const { data, error } = await supabase.from('meal_plans').select('plan').eq('user_id', userId).maybeSingle();
            console.log('[PlannerTooltip] today=', today, 'supabase data=', data, 'error=', error);
            const plan = data?.plan || JSON.parse(localStorage.getItem('meal-planner-week') || '{}');
            console.log('[PlannerTooltip] plan keys=', Object.keys(plan), 'dayPlan=', plan[today]);
            const dayPlan = plan[today] || {};
            const midiRecipe = dayPlan['Midi'];
            const soirRecipe = dayPlan['Soir'];
            // Store full recipe objects so openRecipe event has all data
            setTodayMeals({ midi: midiRecipe || undefined, soir: soirRecipe || undefined });
        };

        const init = (session: any) => {
            const user = session?.user ?? null;
            setAuthUser(user);
            if (user) loadTodayMeals(user.id);
            else { setTodayMeals({}); try { localStorage.removeItem('favorites'); } catch {} }
            // rafraîchit le compteur de favoris (0 si déconnecté)
            window.dispatchEvent(new Event('magic-favorite-change'));
        };
        supabase.auth.getSession().then(({ data: { session } }) => init(session));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => init(session));
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const handleSearchOpen = () => setIsSearchOpen(true);
        window.addEventListener('magic-search-open', handleSearchOpen);

        // Ouverture du planificateur depuis le FAB mobile (ou ailleurs).
        const handleOpenPlanner = () => setIsPlannerOpen(true);
        window.addEventListener('magic-open-planner', handleOpenPlanner);

        const updateFavoriteCount = async () => {
            // Favoris réservés aux connectés : 0 si pas de session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) { setFavoriteCount(0); return; }
            // Source de vérité = Supabase (le localStorage peut être désync entre appareils).
            const { count, error } = await supabase
                .from('favorites')
                .select('recipe_id', { count: 'exact', head: true })
                .eq('user_id', session.user.id);
            if (!error && typeof count === 'number') {
                setFavoriteCount(count);
            } else {
                const favorites = JSON.parse(localStorage.getItem('favorites') || '[]');
                setFavoriteCount(favorites.length);
            }
        };
        updateFavoriteCount();
        window.addEventListener('storage', updateFavoriteCount);
        window.addEventListener('magic-favorite-change', updateFavoriteCount);

        // Pastille liste de courses : nombre de lignes de la liste fusionnée
        const updateShoppingCount = () => setShoppingCount(countConsolidatedLines());
        updateShoppingCount();
        window.addEventListener('storage', updateShoppingCount);
        window.addEventListener('shoppingListUpdated', updateShoppingCount);

        const handleToast = (e: any) => {
            setToast({ message: e.detail || 'Opération réussie !', show: true });
            setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
        };
        window.addEventListener('magic-toast-notify', handleToast);

        return () => {
            window.removeEventListener('magic-search-open', handleSearchOpen);
            window.removeEventListener('magic-open-planner', handleOpenPlanner);
            window.removeEventListener('storage', updateFavoriteCount);
            window.removeEventListener('magic-favorite-change', updateFavoriteCount);
            window.removeEventListener('storage', updateShoppingCount);
            window.removeEventListener('shoppingListUpdated', updateShoppingCount);
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
                            <div ref={pillRef} className={`${styles.searchPillWrapper} ${scrolled ? styles.isExpanded : ''}`}>
                                {!scrolled ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '6px', paddingRight: '6px' }}>
                                        {rightAction}
                                        <button className={styles.pillBtnSearch} onClick={() => setIsSearchOpen(true)}>
                                            Recherche
                                        </button>
                                        {authUser && (
                                            <div style={{ position: 'relative' }}
                                                onMouseEnter={() => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(true); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: true } })); }}
                                                onMouseLeave={() => { plannerHideTimer.current = setTimeout(() => { setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); }, 450); }}
                                            >
                                                <button ref={plannerBtnRef} className={styles.plannerIconBtn} onClick={() => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); if (scrolled) window.scrollTo({ top: 0, behavior: 'smooth' }); setIsPlannerOpen(v => !v); }}>
                                                    <PlannerIcon size={32} />
                                                </button>
                                                <PlannerTooltip visible={showPlannerTooltip} midi={todayMeals.midi} soir={todayMeals.soir} anchorRef={pillRef as any} />
                                            </div>
                                        )}
                                        {shoppingCount > 0 && (
                                            <Link href="/shopping-list" className={styles.plannerIconBtn} style={{ position: 'relative', fontSize: '1.6rem', lineHeight: 1, textDecoration: 'none', overflow: 'visible' }} title="Liste de courses">
                                                🛒
                                                <span className={styles.navFavBadge} style={{ top: '-5px', right: '-7px' }}>{shoppingCount > 99 ? '99+' : shoppingCount}</span>
                                            </Link>
                                        )}
                                        <ThemeToggle className={styles.themeToggleWrapper} />
                                        <AuthButton />
                                    </div>
                                ) : (
                                    <div className={styles.expandedUtils}>
                                        <div className={styles.toolsGroup}>
                                            {rightAction}
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
                                                {shoppingCount > 0 && (
                                                    <span className={styles.navFavBadge}>{shoppingCount > 99 ? '99+' : shoppingCount}</span>
                                                )}
                                            </Link>
                                            {authUser && (
                                            <div style={{ position: 'relative' }}
                                                onMouseEnter={() => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(true); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: true } })); }}
                                                onMouseLeave={() => { plannerHideTimer.current = setTimeout(() => { setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); }, 450); }}
                                            >
                                                <button ref={plannerBtnRef} className={styles.plannerIconBtn} onClick={() => { clearTimeout(plannerHideTimer.current); setShowPlannerTooltip(false); window.dispatchEvent(new CustomEvent('planner-tooltip', { detail: { visible: false } })); setIsPlannerOpen(v => !v); }}>
                                                    <PlannerIcon size={32} />
                                                </button>
                                                <PlannerTooltip visible={showPlannerTooltip} midi={todayMeals.midi} soir={todayMeals.soir} anchorRef={pillRef as any} />
                                            </div>
                                            )}
                                            <AuthButton />
                                            <ThemeToggle className={styles.themeToggleWrapper} />
                                        </div>
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
            <WeekPlanner isOpen={isPlannerOpen} onClose={() => setIsPlannerOpen(false)} />
        </>
    );
}
