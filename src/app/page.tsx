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

    // Filtrage des recettes par tags avec règles intelligentes
    const filteredRecipes = useMemo(() => {
        if (hasNoRecipes || activeTags.length === 0) return mockRecipes || [];
        
        let results = mockRecipes.filter(r => {
            const recipeTags = r.tags?.map(t => t.toLowerCase()) || [];
            const recipeCat = r.category?.toLowerCase() || "";
            const title = (r.title || "").toLowerCase();
            
            return activeTags.some(currentTag => {
                const tagLower = currentTag.toLowerCase();
                
                // Logique spéciale pour Végétarien
                if (tagLower === 'vegetarien') {
                    return recipeTags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || recipeCat === 'vegetarien' || title.includes('végé') || title.includes('vgt');
                }

                // Logique spéciale pour Pâques (Agneau = Pâques)
                if (tagLower === 'pâques') {
                    return recipeTags.some(t => t.toLowerCase() === 'pâques' || t.toLowerCase() === 'agneau') || title.includes('agneau');
                }

                // Pour les pays (France, Italie, etc.)
                const countries = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
                if (countries.includes(tagLower)) {
                    return recipeTags.some(t => t.toLowerCase() === tagLower);
                }
                
                // 2. Détection du type de plat (Salé vs Sucré)
                const isSavory = title.includes('poulet') || title.includes('viande') || title.includes('gratin') || 
                               title.includes('pâtes') || title.includes('pizza') || title.includes('salade') ||
                               title.includes('agneau') || title.includes('poisson') || title.includes('riz') ||
                               title.includes('burger') || title.includes('soupe') || title.includes('quiche') ||
                               title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') ||
                               title.includes('légume') || title.includes('fromage') || title.includes('patate') ||
                               title.includes('pomme de terre') || title.includes('oeuf') || title.includes('œuf') ||
                               title.includes('crevette') || title.includes('saumon') || title.includes('thon') ||
                               title.includes('pesto') || title.includes('tomate') || title.includes('bagel') ||
                               title.includes('bruschetta') || title.includes('casatiello') || title.includes('focaccia') ||
                               title.includes('bread') || title.includes('pain') || title.includes('olive');

                const isPlat = (title.includes('poulet') || title.includes('agneau') || title.includes('gratin') || 
                              title.includes('burger') || title.includes('viande') || title.includes('pâtes') ||
                              title.includes('riz') || title.includes('rôti') || title.includes('confit') ||
                              recipeTags.includes('plat') || recipeCat.includes('plat') || recipeCat.includes('plats')) && !title.includes('apéro');
                
                const isApero = title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') || 
                              title.includes('cocktail') || recipeTags.includes('aperitif') || recipeTags.includes('apéro') ||
                              recipeCat.includes('aperitifs') || recipeCat.includes('apéro') || title.includes('houmous');

                const isEntree = title.includes('salade') || title.includes('soupe') || title.includes('velouté') ||
                               title.includes('œuf') || title.includes('entrée') || recipeTags.includes('entrée') ||
                               recipeCat.includes('entrees') || recipeCat.includes('entrée') || title.includes('carpaccio');

                const isDessert = (title.includes('chocolat') || title.includes('sucre') || 
                                 title.includes('fruit') || title.includes('tiramisu') || title.includes('crème') ||
                                 title.includes('mousse') || title.includes('yaourt') || title.includes('sorbet') ||
                                 title.includes('glace') || recipeCat.includes('dessert') || recipeTags.includes('desserts') || recipeTags.includes('dessert')) && !isSavory && !title.includes('gâteau') && !title.includes('cake');

                const isPatisserie = (title.includes('gâteau') || title.includes('cake') || title.includes('tarte sucrée') || 
                                    title.includes('cookie') || title.includes('muffins') || title.includes('pâtisserie') ||
                                    recipeCat.includes('patisserie')) && !isSavory;

                // Attribution Prioritaire
                if (tagLower === 'plats' && isPlat) return true;
                if (tagLower === 'aperitifs' && isApero) return true;
                if (tagLower === 'entrees' && isEntree) return true;
                if (tagLower === 'desserts' && isDessert) return true;
                if (tagLower === 'patisserie' && isPatisserie) return true;

                // Par défaut : match catégorie ou tag
                const isMatch = recipeCat === tagLower || recipeCat.includes(tagLower) || tagLower.includes(recipeCat) || recipeTags.some(t => t.includes(tagLower));
                
                if ((tagLower === 'patisserie' || tagLower === 'desserts') && isSavory) return false;

                return isMatch;
            });
        });

        // SHUFFLE pour La Dolce Vita (Italie uniquement)
        if (activeTags.length === 1 && activeTags[0].toLowerCase() === 'italie') {
            return [...results].sort(() => Math.random() - 0.5);
        }

        return results;
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

    // Initialisation via query param (ex: /?tags=Italie,Pâtes)
    useEffect(() => {
        const tagsParam = searchParams.get('tags');
        const tagParam = searchParams.get('tag'); // Garder compatibilité avec l'ancien
        
        if (tagsParam) {
            setActiveTags(tagsParam.split(','));
        } else if (tagParam) {
            setActiveTags([tagParam]);
        }
        
        if (tagsParam || tagParam) {
            // Scroll direct
            setTimeout(() => {
                const resultsSection = document.getElementById('categories-title');
                if (resultsSection) {
                    const isMobile = window.innerWidth <= 768;
                    const headerOffset = isMobile ? 420 : 250; 
                    window.scrollTo({
                        top: resultsSection.getBoundingClientRect().top + window.pageYOffset - headerOffset,
                        behavior: 'smooth'
                    });
                }
            }, 500);
        }
    }, [searchParams]);

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
                        <div className={styles.sectionSpacer} style={{ height: '20px' }} />
                        <ResumeRecipe />
                        <div className={styles.sectionSpacer} style={{ height: '30px' }} />
                        <ThematicGroup activeTags={activeTags} />
                        <div className={styles.sectionSpacer} />
                    </>
                )}

                {/* ANCRE ET TITRE DE RÉSULTATS */}
                <div id="categories-title" className={styles.categoriesAnchor}></div>
                
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
                            const title = r.title.toLowerCase();
                            const tags = r.tags?.map(t => t.toLowerCase()) || [];
                            const cat = r.category?.toLowerCase() || "";
                            const catId = category.id.toLowerCase();
                            
                            // 1. Logique Spéciale Végétarien
                            if (catId === 'vegetarien') {
                                return tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || 
                                       cat.includes('vegetarien') || 
                                       title.includes('végé') || title.includes('vgt');
                            }

                            // 2. Détection du type de plat (Salé vs Sucré)
                            const isSavory = title.includes('poulet') || title.includes('viande') || title.includes('gratin') || 
                                           title.includes('pâtes') || title.includes('pizza') || title.includes('salade') ||
                                           title.includes('agneau') || title.includes('poisson') || title.includes('riz') ||
                                           title.includes('burger') || title.includes('soupe') || title.includes('quiche') ||
                                           title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') ||
                                           title.includes('légume') || title.includes('fromage') || title.includes('patate') ||
                                           title.includes('pomme de terre') || title.includes('oeuf') || title.includes('œuf') ||
                                           title.includes('crevette') || title.includes('saumon') || title.includes('thon') ||
                                           title.includes('pesto') || title.includes('tomate') || title.includes('bagel') ||
                                           title.includes('bruschetta') || title.includes('casatiello') || title.includes('focaccia') ||
                                           title.includes('bread') || title.includes('pain') || title.includes('olive');

                            const isPlat = (title.includes('poulet') || title.includes('agneau') || title.includes('gratin') || 
                                          title.includes('burger') || title.includes('viande') || title.includes('pâtes') ||
                                          title.includes('riz') || title.includes('rôti') || title.includes('confit') ||
                                          tags.includes('plat') || cat.includes('plat') || cat.includes('plats')) && !title.includes('apéro');
                            
                            const isApero = title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') || 
                                          title.includes('cocktail') || tags.includes('aperitif') || tags.includes('apéro') ||
                                          cat.includes('aperitifs') || cat.includes('apéro') || title.includes('houmous');

                            const isEntree = title.includes('salade') || title.includes('soupe') || title.includes('velouté') ||
                                           title.includes('œuf') || title.includes('entrée') || tags.includes('entrée') ||
                                           cat.includes('entrees') || cat.includes('entrée') || title.includes('carpaccio');

                            const isDessert = (title.includes('chocolat') || title.includes('sucre') || 
                                             title.includes('fruit') || title.includes('tiramisu') || title.includes('crème') ||
                                             title.includes('mousse') || title.includes('yaourt') || title.includes('sorbet') ||
                                             title.includes('glace') || cat.includes('dessert')) && !isSavory && !title.includes('gâteau') && !title.includes('cake');

                            const isPatisserie = (title.includes('gâteau') || title.includes('cake') || title.includes('tarte sucrée') || 
                                                title.includes('cookie') || title.includes('muffins') || title.includes('pâtisserie') ||
                                                cat.includes('patisserie')) && !isSavory;

                            // Attribution Prioritaire
                            if (catId === 'plats' && isPlat) return true;
                            if (catId === 'aperitifs' && isApero) return true;
                            if (catId === 'entrees' && isEntree) return true;
                            if (catId === 'desserts' && isDessert) return true;
                            if (catId === 'patisserie' && isPatisserie) return true;

                            // 3. Fallback Match classique (si pas déjà classé par mot-clé)
                            const isMatch = cat.includes(catId) || 
                                           catId.includes(cat) || 
                                           tags.some(t => t.includes(catId) || catId.includes(t.toLowerCase()));
                            
                            // Sécurité pour éviter les doublons ou erreurs si c'est du salé dans du sucré
                            if ((catId === 'patisserie' || catId === 'desserts') && isSavory) return false;

                            return isMatch;
                        });

                        // Optimisation performance : slice(0, 20) pour la page d'accueil
                        const categoryRecipes = allCategoryRecipes.slice(0, 20);
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
    const scrollSpeed = useRef(0);
    const animationFrame = useRef<number>();

    const updateScroll = useCallback(() => {
        if (scrollRef.current && scrollSpeed.current !== 0) {
            scrollRef.current.scrollLeft += scrollSpeed.current;
        }
        animationFrame.current = requestAnimationFrame(updateScroll);
    }, []);

    useEffect(() => {
        animationFrame.current = requestAnimationFrame(updateScroll);
        return () => {
            if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
        };
    }, [updateScroll]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;
        const container = scrollRef.current;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        const threshold = 180; 
        if (x < threshold) {
            scrollSpeed.current = -Math.pow((threshold - x) / threshold, 2) * 15;
        } else if (x > rect.width - threshold) {
            scrollSpeed.current = Math.pow((x - (rect.width - threshold)) / threshold, 2) * 15;
        } else {
            scrollSpeed.current = 0;
        }
    }, []);

    const handleMouseLeave = () => {
        scrollSpeed.current = 0;
    };

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
                    onMouseLeave={handleMouseLeave}
                >
                    {recipes.map((recipe: any) => (
                        <div key={recipe.id} className={styles.carouselItem}>
                            <RecipeCard recipe={recipe} activeTags={activeTags} />
                        </div>
                    ))}
                    <div className={styles.carouselItem} style={{ flex: '0 0 280px', width: '280px' }}>
                        <Link 
                            href={`/category/${category.id}`} 
                            className={`${styles.viewMoreCardGrid} ${styles['cat_' + category.id]}`}
                        >
                            <div className={styles.viewMoreContent}>
                                <span className={styles.viewMoreTextTop}>Voir</span>
                                <span className={styles.viewMoreTextBottom}>tout</span>
                            </div>
                        </Link>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}

function ThematicGroup({ activeTags }: { activeTags: string[] }) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scrollSpeed = useRef(0);
    const animationFrame = useRef<number>();

    const updateScroll = useCallback(() => {
        if (scrollRef.current && scrollSpeed.current !== 0) {
            scrollRef.current.scrollLeft += scrollSpeed.current;
        }
        animationFrame.current = requestAnimationFrame(updateScroll);
    }, []);

    useEffect(() => {
        animationFrame.current = requestAnimationFrame(updateScroll);
        return () => {
            if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
        };
    }, [updateScroll]);

    const thematiques = [
        { id: 'paques', name: 'Pâques est là', tags: ['Pâques'], image: '/images/themes/paques.jpg?v=999' },
        { id: 'noel', name: "C'est Noël", tags: ['Noël'], image: '/images/themes/noel.jpg' },
        { id: 'glaces', name: 'Les Glaces', tags: ['glaces'], image: '/images/themes/glaces.jpg' },
        { id: 'rafraichissements', name: 'Rafraîchissements', tags: ['rafraichissements'], image: '/images/themes/rafraichissements.jpg' },
        { id: 'simplissime', name: 'Simplissime', tags: ['Simplissime'], image: '/images/themes/simplissime.jpg' },
        { id: 'dolce-vita', name: 'La Dolce Vita', tags: ['Italie'], image: '/images/themes/dolce-vita.jpg' }
    ];

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        if (window.matchMedia('(pointer: coarse)').matches) return;
        const container = scrollRef.current;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        const threshold = 180; 
        if (x < threshold) {
            scrollSpeed.current = -Math.pow((threshold - x) / threshold, 2) * 15;
        } else if (x > rect.width - threshold) {
            scrollSpeed.current = Math.pow((x - (rect.width - threshold)) / threshold, 2) * 15;
        } else {
            scrollSpeed.current = 0;
        }
    }, []);

    const handleMouseLeave = () => {
        scrollSpeed.current = 0;
    };

    if (activeTags.length > 0) return null;

    return (
        <section className={styles.thematicSection}>
            <div className={styles.categoryHeader}>
                <div className={styles.categoryTitleGroup}>
                    <h2 className={styles.categoryTitle}>Thématiques du moment</h2>
                </div>
            </div>
            <motion.div 
                className={styles.thematicCarouselWrapper}
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
                    className={styles.thematicCarousel}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                >
                    {thematiques.map((theme) => (
                        <Link 
                            key={theme.id} 
                            href={`/?tags=${theme.tags.join(',')}`} 
                            className={styles.thematicCard}
                        >
                            <img src={theme.image} alt={theme.name} className={styles.thematicImage} />
                            <div className={styles.thematicOverlay}></div>
                            <h3 className={styles.thematicTitle}>{theme.name}</h3>
                        </Link>
                    ))}
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
// Refresh Visuel Fri Apr  3 12:14:58 CEST 2026
