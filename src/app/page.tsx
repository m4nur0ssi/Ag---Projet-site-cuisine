'use client';
// Vercel Deployment Sync V17.9 - iPhone Power Edition
import { useState, useMemo, useRef, useCallback, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { mockRecipes } from '@/data/mockData';
import Header from '@/components/Header/Header';
import HeroHome from '@/components/HeroHome/HeroHome';
import RecipeCard from '@/components/RecipeCard/RecipeCardV2';
import ResumeRecipe from '@/components/ResumeRecipe/ResumeRecipe';
import MagicFilterBar from '@/components/MagicFilterBar/MagicFilterBar';
import BackToTop from '@/components/BackToTop/BackToTop';
import styles from './page.module.css';

const categories = [
    { id: 'aperitifs', name: 'Apéritifs' },
    { id: 'entrees', name: 'Entrées' },
    { id: 'plats', name: 'Plats' },
    { id: 'vegetarien', name: 'Végétarien' },
    { id: 'desserts', name: 'Desserts' },
    { id: 'patisserie', name: 'Pâtisserie' },
    { id: 'restaurant', name: 'Restaurant' }
];

function HomeContent() {
    const searchParams = useSearchParams();
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const hasNoRecipes = !mockRecipes || mockRecipes.length === 0;

    // Filtrer les recettes par tous les tags actifs (Logique AND)
    const filteredRecipes = useMemo(() => {
        if (hasNoRecipes || activeTags.length === 0) return mockRecipes || [];
        
        return mockRecipes.filter(r => {
            const recipeTags = r.tags?.map(t => t.toLowerCase()) || [];
            const recipeCat = r.category?.toLowerCase();
            
            return activeTags.every(currentTag => {
                const tagLower = currentTag.toLowerCase();
                
                // Logique spéciale pour Végétarien
                if (tagLower === 'vegetarien') {
                    return recipeTags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || recipeCat === 'vegetarien';
                }

                // Pour les pays (France, Italie, etc.), on veut un match plus précis
                const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
                if (countries.includes(tagLower)) {
                    return recipeTags.some(t => t.toLowerCase() === tagLower);
                }
                
                // Par défaut : match catégorie ou tag (includes)
                return recipeCat === tagLower || recipeTags.some(t => t.includes(tagLower));
            });
        });
    }, [activeTags, hasNoRecipes]);

    // Texte d'affichage des filtres
    const activeFiltersLabel = useMemo(() => {
        if (activeTags.length === 0) return "";
        return activeTags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(" + ");
    }, [activeTags]);

    // Top 5 pour le carousel Hero (basé sur le premier tag ou le dernier ajouté)
    const top5TagRecipes = useMemo(() => {
        if (hasNoRecipes || activeTags.length === 0 || filteredRecipes.length === 0) return undefined;
        
        return [...filteredRecipes].sort((a, b) => {
            const votesA = a.votes || 0;
            const votesB = b.votes || 0;
            if (votesA !== votesB) return votesB - votesA;
            return parseInt(b.id) - parseInt(a.id);
        }).slice(0, 5);
    }, [activeTags, filteredRecipes, hasNoRecipes]);

    const handleTagSelect = useCallback((tag: string | null) => {
        if (!tag) {
            setActiveTags([]);
            if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
        }

        const mainCategories = ['aperitifs', 'entrees', 'plats', 'desserts', 'patisserie', 'restaurant'];
        const tagLower = tag.toLowerCase();
        const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
        const isCountry = countries.includes(tagLower);

        setActiveTags(prev => {
            if (prev.includes(tag)) {
                return prev.filter(t => t !== tag);
            }
            
            // 1. Si c'est un pays, on remplace le pays existant si nécessaire (exclusivité des pays)
            if (isCountry) {
                const otherFilters = prev.filter(t => !countries.includes(t.toLowerCase()));
                return [...otherFilters, tag];
            }

            // 2. EXCLUSIVITÉ DES CATÉGORIES (Sauf Végétarien)
            if (mainCategories.includes(tagLower)) {
                const otherFilters = prev.filter(t => !mainCategories.includes(t.toLowerCase()));
                return [...otherFilters, tag];
            }

            return [...prev, tag];
        });

        // Scroller vers la section des résultats avec précision
        if (typeof window !== 'undefined') {
            const resultsSection = document.getElementById('categories-title');
            if (resultsSection) {
                setTimeout(() => {
                    const isMobile = window.innerWidth <= 768;
                    const headerOffset = isMobile ? 420 : 250; 
                    const elementPosition = resultsSection.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({
                        top: elementPosition - headerOffset,
                        behavior: 'smooth'
                    });
                }, 300);
            }
        }
    }, [setActiveTags]);

    // Initialisation via query param (ex: /?tag=France)
    useEffect(() => {
        const tag = searchParams.get('tag');
        if (tag) {
            handleTagSelect(tag);
        }
    }, [searchParams, handleTagSelect]);

    // Écouteur pour reset global via le Header
    useEffect(() => {
        const handleReset = () => {
            handleTagSelect(null);
        };
        window.addEventListener('magic-reset-filters', handleReset);
        return () => window.removeEventListener('magic-reset-filters', handleReset);
    }, [handleTagSelect]);

    // Sécurité si les données sont vides - PLACÉ APRÈS LES HOOKS
    if (hasNoRecipes) {
        return (
            <div className={styles.page}>
                <Header title="Chargement..." />
                <main className={styles.main}>
                    <p>Aucune recette trouvée. Lancez la synchronisation !</p>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header title={activeTags.length > 0 ? activeFiltersLabel : "Les Recettes Magiques"} large={true} />
                <MagicFilterBar 
                    activeTags={activeTags} 
                    onSelect={handleTagSelect}
                    isHome={true} 
                />
            </div>

            <main className={styles.main}>
                {/* SECTION CAROUSEL (HERO) */}
                {activeTags.length === 0 && (
                    <>
                        <HeroHome />
                        <div className={styles.sectionSpacer} />
                    </>
                )}

                {/* ANCRE ET TITRE DE RÉSULTATS */}
                <div id="categories-title" className={styles.categoriesAnchor}></div>
                
                {activeTags.length === 0 && (
                    <>
                        <div className={styles.sectionSpacer} style={{ height: '40px' }} />
                        <ResumeRecipe />
                        <div className={styles.sectionSpacer} style={{ height: '40px' }} />
                    </>
                )}
                
                <motion.div
                    key={activeTags.join('|') || 'all'}
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: { opacity: 0 },
                        visible: {
                            opacity: 1,
                            transition: {
                                duration: 0.8
                            }
                        }
                    }}
                >
                    {activeTags.length > 0 && filteredRecipes.length > 0 && (
                        <motion.section 
                            className={styles.categorySection}
                            variants={{
                                hidden: { opacity: 0, y: 20 },
                                visible: { opacity: 1, y: 0 }
                            }}
                        >
                            <div className={styles.sectionSpacer} style={{ height: '15px' }} />
                             <div className={styles.sectionSpacer} style={{ height: '15px' }} />
                            <div className={styles.sectionSpacer} style={{ height: '30px' }} />
                            <div className={styles.resultsGrid}>
                                {filteredRecipes.map((recipe) => (
                                    <div key={recipe.id} className={styles.gridItem}>
                                        <RecipeCard recipe={recipe} activeTags={activeTags} />
                                    </div>
                                ))}
                            </div>
                        </motion.section>
                    )}

                    {activeTags.length > 0 && filteredRecipes.length === 0 && (
                        <motion.div 
                            className={styles.noResults}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                        >
                            <div className={styles.noResultsIllustration}>🔍</div>
                            <h2 className={styles.noResultsTitle}>Aucune recette trouvée...</h2>
                            <p className={styles.noResultsText}>
                                Pas encore de recette pour <span className={styles.filterHighlight}>&quot;{activeFiltersLabel}&quot;</span>. 
                                <br/>On lance le chaudron ? 👨‍🍳
                            </p>
                            <button onClick={() => handleTagSelect(null)} className={styles.premiumResetBtn}>
                                <span className={styles.btnContent}>RÉINITIALISER TOUT ✨</span>
                            </button>
                        </motion.div>
                    )}

                    {activeTags.length === 0 && categories.map((category) => {
                        const allCategoryRecipes = mockRecipes.filter(r => {
                            const tags = r.tags?.map(t => t.toLowerCase()) || [];
                            const cat = r.category?.toLowerCase();
                            if (category.id === 'vegetarien') {
                                return tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || cat === 'vegetarien';
                            }
                            return cat === category.id || tags.includes(category.id);
                        });
                        const categoryRecipes = allCategoryRecipes.slice(0, 10);
                        if (categoryRecipes.length === 0) return null;
                        return <CategoryGroup 
                            key={category.id} 
                            category={category} 
                            recipes={categoryRecipes} 
                            activeTags={activeTags}
                        />;
                    })}
                </motion.div>
            </main>
            <BackToTop />
        </div>
    );
}

function CategoryGroup({ category, recipes, activeTags }: { category: any, recipes: any[], activeTags: string[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;
        const container = scrollRef.current;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const threshold = 50; 
        let percentage;
        if (x < threshold) {
            percentage = 0;
        } else if (x > rect.width - threshold) {
            percentage = 1;
        } else {
            percentage = (x - threshold) / (rect.width - 2 * threshold);
        }
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;
        const maxScroll = scrollWidth - clientWidth;
        container.scrollLeft = percentage * maxScroll;
    }, []);

    return (
        <section className={styles.categorySection}>
            <div className={styles.categoryHeader}>
                <div className={styles.categoryTitleGroup}>
                    <Link href={`/category/${category.id}`} className={styles.categoryLink}>
                        <h2 className={styles.categoryTitle}>{category.name}</h2>
                    </Link>
                </div>
                <Link href={`/category/${category.id}`} className={styles.seeAll}>
                    Voir tout →
                </Link>
            </div>
            <motion.div 
                className={styles.categoryCarouselWrapper}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-100px" }}
                variants={{
                    hidden: { opacity: 0, y: 20 },
                    visible: { opacity: 1, y: 0, transition: { duration: 0.6 } }
                }}
            >
                <div 
                    ref={scrollRef}
                    className={styles.categoryCarousel}
                    onMouseMove={handleMouseMove}
                >
                    {recipes.map((recipe: any) => (
                        <div key={recipe.id} className={styles.carouselItem}>
                            <RecipeCard recipe={recipe} activeTags={activeTags} />
                        </div>
                    ))}
                    <div className={styles.carouselItem} style={{ flex: '0 0 200px' }}>
                        <Link href={`/category/${category.id}`} className={styles.viewMoreCardGrid}>
                            <div className={styles.viewMoreContent}>
                                <span className={styles.viewMoreText}>Voir tout</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div>Chargement...</div>}>
            <HomeContent />
        </Suspense>
    );
}
