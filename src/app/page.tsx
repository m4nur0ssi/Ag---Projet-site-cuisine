'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header/Header';
import RecipeCarousel from '../components/RecipeCarousel/RecipeCarousel';
import RecipeGrid from '../components/RecipeGrid/RecipeGrid';
import dynamic from 'next/dynamic';
const MagicFilterBar = dynamic(() => import('../components/MagicFilterBar/MagicFilterBar'), { ssr: false });
import { useRouter } from 'next/navigation';
import { mockRecipes } from '../data/mockData';
import { decodeHtml } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './page.module.css';

export default function Home() {
    const [scrolled, setScrolled] = useState(false);
    const [activeFilters, setActiveFilters] = useState<{tag: string, group: string}[]>([]);
    const activeTags = useMemo(() => activeFilters.map(f => f.tag), [activeFilters]);
    const [touchStart, setTouchStart] = useState<number>(0);
    const [touchEnd, setTouchEnd] = useState<number>(0);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleTagSelect = (tag: string, groupId?: string) => {
        if (!groupId) {
            const lowerTag = tag.toLowerCase();
            const categoriesIds = ['aperitifs', 'entrees', 'plats', 'vegetarien', 'desserts', 'patisserie', 'restaurant', 'apéro', 'entrée'];
            const countriesIds = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
            
            if (categoriesIds.some(c => lowerTag.includes(c))) groupId = 'categories';
            else if (countriesIds.some(c => lowerTag.includes(c))) groupId = 'countries';
            else groupId = 'trends'; 
        }

        setActiveFilters(prev => {
            const existing = prev.find(f => f.tag === tag);
            if (existing) {
                return prev.filter(f => f.tag !== tag);
            }
            const filtered = prev.filter(f => f.group !== groupId);
            return [...filtered, { tag, group: groupId }];
        });
    };

    const handleCarouselTitleClick = (title: string) => {
        // Strip emojis but KEEP accents (very important for French labels mapping)
        const cleanTitle = title.replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/g, '').toLowerCase().trim();
        
        const mapping: Record<string, string> = {
            'thématiques du moment': 'thématiques',
            'thématiques': 'thématiques',
            'les nouveautés': 'nouveautés',
            'spécial pâques': 'pâques',
            'paques': 'pâques',
            'pâques': 'pâques',
            'pâques est là': 'pâques',
            'paques est la': 'pâques',
            'simplissime': 'simplissime',
            'apéro gourmand': 'aperitifs',
            'entrées fraîches': 'entrees',
            'plats de chef': 'plats',
            'douceurs sucrées': 'desserts',
            'atelier de pâtisserie': 'patisserie',
            'atelier pâtisserie': 'patisserie',
            'pâtisserie': 'patisserie',
            'comme au resto': 'restaurant',
            'green healthy': 'vegetarien',
            'la dolce vita': 'italie',
            // Avec apostrophe (version brute)
            'c\'est noël': 'Noël',
            'noël': 'Noël',
            'noel': 'Noël',
            // Sans apostrophe (après nettoyage regex)
            'cest noël': 'Noël',
            'cest noel': 'Noël',
            'spécial noël': 'Noël',
            'special noel': 'Noël',
            // Été / Hiver
            'voilà l\'été': 'voila-lete',
            'voila lete': 'voila-lete',
            'voilà lete': 'voila-lete',
            'c\'est l\'hiver': 'cest-lhiver',
            'cest lhiver': 'cest-lhiver',
            'cest lhiver ': 'cest-lhiver',
            // Autres
            'astuces': 'Astuces',
            'les glaces': 'glaces',
            'glaces': 'glaces',
            'rafraîchissements': 'boissons',
            'rafraichissements': 'boissons',
            'sauces': 'sauces',
            'sauce': 'sauces',
            'healthy': 'healthy',
            'airfryer': 'airfryer',
            'barbecue': 'barbecue',
            'bbq': 'barbecue',
            'pas cher': 'pas cher',
            'express': 'express',
            'famille': 'famille',
            'familial': 'famille',
            'végé': 'vegetarien',
            'vege': 'vegetarien'
        };

        const tag = mapping[cleanTitle] || cleanTitle;
        handleTagSelect(tag);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearAllFilters = () => {
        setActiveFilters([]);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (touchStart < 100 && (touchEnd - touchStart) > 100) {
            if (activeTags.length > 0) {
                clearAllFilters();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    };

    const filteredRecipes = useMemo(() => {
        if (activeTags.length === 0) return mockRecipes;

        return mockRecipes.filter(recipe => {
            const recipeTags = (recipe.tags || []).map(t => t.toLowerCase());
            const recipeCat = (recipe.category || '').toLowerCase();

            return activeTags.every(currentTag => {
                const tagLower = currentTag.toLowerCase();
                const titleLower = recipe.title.toLowerCase();
                const fullText = `${titleLower} ${(recipe.steps || []).join(' ')} ${(recipe.ingredients || []).map(i => i.name).join(' ')}`.toLowerCase();

                // 1. BOISSONS (Rafraîchissements)
                if (tagLower === 'boissons') {
                    return recipeCat === 'boissons' || recipeTags.some(t => t.includes('boisson') || t.includes('cocktail') || t.includes('jus') || t.includes('rafra')) ||
                           ['boisson', 'cocktail', 'jus', 'smoothie', 'mojito', 'limonade', 'café', 'thé'].some(k => titleLower.includes(k));
                }

                // 2. SANS VIANDE (Végétarien) -> "que des légumes"
                if (tagLower === 'vegetarien') {
                    if (recipeTags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || recipeCat === 'vegetarien') return true;
                    // Détection "sans viande" : on vérifie qu'il n'y a PAS de viande/poisson dans le texte complet
                    const meatKeywords = ['poulet', 'bœuf', 'boeuf', 'porc', 'veau', 'agneau', 'canard', 'dinde', 'saucisse', 'chorizo', 'lardon', 'jambon', 'poisson', 'saumon', 'thon', 'crevette', 'cabillaud', 'fruits de mer'];
                    const hasMeat = meatKeywords.some(meat => fullText.includes(meat));
                    // Et c'est un plat ou une entrée, pas un dessert
                    const isSweet = ['gâteau', 'cake', 'tarte', 'chocolat', 'sucre', 'dessert', 'patisserie', 'glace'].some(s => titleLower.includes(s)) || ['desserts', 'patisserie', 'glaces'].includes(recipeCat);
                    return !hasMeat && !isSweet;
                }

                // 3. GLACES
                if (tagLower === 'glaces') {
                    return recipeCat === 'glaces' || recipeTags.some(t => t.includes('glace') || t.includes('sorbet')) ||
                           ['glace', 'sorbet', 'crème glacée', 'bûche glacée'].some(k => titleLower.includes(k));
                }

                // 4. FAMILLE (Plats familiaux au four la plupart du temps)
                if (tagLower === 'famille' || tagLower === 'familial') {
                    if (recipeTags.some(t => t.toLowerCase() === 'famille' || t.toLowerCase() === 'familial') || titleLower.includes('familial') || titleLower.includes('famille')) return true;
                    // Détection au four, familial
                    return fullText.includes('four') && (recipe.servings || 0) >= 4 && !['desserts', 'patisserie', 'glaces', 'boissons', 'aperitifs', 'sauces'].includes(recipeCat);
                }

                // 5. EXPRESS (Plats très rapides - de 30 minutes)
                if (tagLower === 'express') {
                    if (recipeTags.some(t => t.toLowerCase() === 'express' || t.toLowerCase() === 'rapide') || titleLower.includes('express') || titleLower.includes('rapide')) return true;
                    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                    return totalTime > 0 && totalTime <= 30 && !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
                }

                // 6. PAS CHER
                if (tagLower === 'pas cher' || tagLower === 'pas-cher') {
                    if (recipeTags.some(t => t.toLowerCase() === 'pas cher' || t.toLowerCase() === 'pas-cher') || titleLower.includes('pas cher')) return true;
                    // Ingrédients basiques (pâtes, riz, pommes de terre, oeufs) sans viandes chères (bœuf, saumon, agneau)
                    const cheapKeywords = ['pâtes', 'pasta', 'riz', 'pommes de terre', 'patate', 'oeuf', 'œuf', 'lentilles', 'haricots'];
                    const expensiveKeywords = ['bœuf', 'boeuf', 'agneau', 'saumon', 'truffe', 'caviar', 'foie gras', 'veau'];
                    const hasCheap = cheapKeywords.some(k => titleLower.includes(k) || fullText.includes(k));
                    const hasExpensive = expensiveKeywords.some(k => fullText.includes(k));
                    return hasCheap && !hasExpensive && !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
                }

                // 7. SAUCES (Que des sauces)
                if (tagLower === 'sauces' || tagLower === 'sauce') {
                    return recipeCat === 'sauces' || recipeTags.some(t => t.toLowerCase() === 'sauces' || t.toLowerCase() === 'sauce') ||
                           ['sauce', 'pesto', 'mayo', 'ketchup', 'vinaigrette', 'béarnaise', 'tzatziki', 'guacamole', 'kebab'].some(k => titleLower.includes(k));
                }

                // 8. HEALTHY (Différent de végétarien)
                if (tagLower === 'healthy') {
                    if (recipeTags.some(t => t.toLowerCase() === 'healthy' || t.toLowerCase() === 'diététique' || t.toLowerCase() === 'sain') || titleLower.includes('healthy')) return true;
                    // Léger, salades, légumes sans trop de gras
                    const healthyKeywords = ['salade', 'légumes', 'vapeur', 'healthy', 'sain', 'léger', 'bowl'];
                    const fatKeywords = ['frit', 'beurre', 'crème fraîche', 'friture', 'burger', 'pizza', 'fromage fondu', 'raclette', 'tartiflette'];
                    return healthyKeywords.some(k => fullText.includes(k)) && !fatKeywords.some(k => fullText.includes(k)) && !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
                }

                // 9. DOLCE VITA (Toutes les recettes italiennes)
                if (tagLower === 'italie' || tagLower === 'dolce vita') {
                    if (recipeTags.some(t => ['italie', 'italy', 'dolce vita', 'italien', 'italienne'].includes(t.toLowerCase())) || recipeCat === 'italie') return true;
                    const italianKeywords = ['pâtes', 'pasta', 'pizza', 'risotto', 'tiramisu', 'pesto', 'gnocchi', 'mozzarella', 'burrata', 'parmesan', 'focaccia', 'carbonara', 'bolognaise'];
                    return italianKeywords.some(k => fullText.includes(k));
                }

                // 10. AIRFRYER
                if (tagLower === 'airfryer') {
                    if (recipeTags.some(t => t.toLowerCase() === 'airfryer') || titleLower.includes('airfryer')) return true;
                    return fullText.includes('airfryer') || fullText.includes('air fryer');
                }

                // 11. BARBECUE
                if (tagLower === 'barbecue' || tagLower === 'bbq') {
                    if (recipeTags.some(t => t.toLowerCase() === 'barbecue' || t.toLowerCase() === 'bbq') || titleLower.includes('barbecue') || titleLower.includes('bbq')) return true;
                    return fullText.includes('barbecue') || fullText.includes('bbq') || fullText.includes('grill') || fullText.includes('plancha');
                }

                if (tagLower === 'noël' || tagLower === 'noel') {
                    return recipeTags.some(t => t.toLowerCase() === 'noël' || t.toLowerCase() === 'noel') ||
                           titleLower.includes('noël') || titleLower.includes('noel');
                }

                if (tagLower === 'pâques' || tagLower === 'paques') {
                    return recipeTags.some(t => t.toLowerCase() === 'pâques' || t.toLowerCase() === 'paques' || t.toLowerCase() === 'agneau') || 
                           titleLower.includes('agneau') || titleLower.includes('pâques');
                }

                // Thématiques saisonnières
                if (tagLower === 'voila-lete') {
                    const summerKeywords = ['été', 'ete', 'voilà', 'voila-lete', 'salade', 'bbq', 'barbecue', 'grillade', 'plancha'];
                    return (recipe.category as string) === 'voila-lete' || 
                           recipeTags.some(t => summerKeywords.some(k => t.toLowerCase().includes(k))) ||
                           summerKeywords.some(k => titleLower.includes(k));
                }
                if (tagLower === 'cest-lhiver') {
                    const winterKeywords = ['hiver', "c'est l'hiver", 'cest-lhiver', 'soupe', 'velouté', 'gratin', 'four', 'réconfortant', 'familial', 'pot-au-feu', 'tartiflette', 'raclette'];
                    return (recipe.category as string) === 'cest-lhiver' || 
                           recipeTags.some(t => winterKeywords.some(k => t.toLowerCase().includes(k))) ||
                           winterKeywords.some(k => titleLower.includes(k));
                }

                if (tagLower === 'simplissime') {
                    return recipeTags.includes('simplissime') || recipeCat === 'simplissime';
                }

                if (tagLower === 'thématiques' || tagLower === 'thématique') {
                    const themedKeywords = ['glace', 'sorbet', 'boisson', 'cocktail', 'pâques', 'paques', 'noël', 'noel', 'agneau', 'chocolat'];
                    const themedCats = ['glaces', 'boissons', 'pâques', 'noël', 'simplissime', 'italie'];
                    return recipeTags.some(t => themedKeywords.includes(t.toLowerCase())) || 
                           themedCats.includes(recipeCat) ||
                           themedKeywords.some(kw => titleLower.includes(kw));
                }

                if (tagLower === 'desserts' || tagLower === 'patisserie') {
                    return recipeCat === 'desserts' || recipeCat === 'patisserie' || 
                           recipeTags.some(t => t.toLowerCase().includes('dessert') || t.toLowerCase().includes('pâtis') || t.toLowerCase().includes('patis'));
                }

                if (tagLower === 'plats') {
                    const platKeywords = ['poulet', 'agneau', 'gratin', 'burger', 'viande', 'pâtes', 'riz', 'rôti', 'confit'];
                    return recipeCat === 'plats' || recipeTags.includes('plat') || recipeTags.includes('plats') ||
                           platKeywords.some(k => titleLower.includes(k));
                }

                if (tagLower === 'aperitifs') {
                    return recipeCat === 'aperitifs' || recipeCat === 'apéro' || recipeCat === 'aperitif' ||
                           recipeTags.some(t => t.includes('aperitif') || t.includes('apéro')) ||
                           ['croquetas', 'apéro', 'tapas', 'houmous'].some(k => titleLower.includes(k));
                }

                if (tagLower === 'entrees') {
                    return recipeCat === 'entrees' || recipeCat === 'entrée' || recipeTags.includes('entrée') ||
                           ['salade', 'soupe', 'velouté', 'carpaccio', 'entrée'].some(k => titleLower.includes(k));
                }

                if (tagLower === 'nouveautés' || tagLower === 'nouveauté') {
                    const sorted = [...mockRecipes].sort((a, b) => parseInt(b.id) - parseInt(a.id));
                    const latestIds = sorted.slice(0, 20).map(r => r.id);
                    return latestIds.includes(recipe.id);
                }

                return recipeCat === tagLower || 
                       recipeTags.some(t => t.includes(tagLower));
            });
        });
    }, [activeTags]);

    const activeFiltersLabel = useMemo(() => {
        if (activeTags.length === 0) return "Les Recettes Magiques";
        return activeTags.map(t => {
            const low = t.toLowerCase();
            if (low === 'thématiques' || low === 'thématique') return 'THÉMATIQUES';
            if (low === 'nouveautés' || low === 'nouveauté') return 'NOUVEAUTÉS';
            if (low === 'simplissime') return 'SIMPLISSIME';
            return t.charAt(0).toUpperCase() + t.slice(1).replace('pâques', 'Pâques').replace('paques', 'Paques');
        }).join(" + ");
    }, [activeTags]);

    const categorizedRecipes = useMemo(() => {
        const groups: Record<string, typeof mockRecipes> = {};
        
        mockRecipes.forEach(recipe => {
            const title = (recipe.title || '').toLowerCase();
            const tags = (recipe.tags || []).map(t => t.toLowerCase());
            const cat = (recipe.category || '').toLowerCase();
            
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

            const isEntree = (title.includes('salade') || title.includes('soupe') || title.includes('velouté') ||
                           (title.includes('œuf') && !title.includes('bœuf')) || title.includes('entrée') || tags.includes('entrée') ||
                           cat.includes('entrees') || cat.includes('entrée') || title.includes('carpaccio')) && !title.includes('apéro');

            const hasMeat = title.includes('poulet') || title.includes('viande') || title.includes('agneau') || 
                            title.includes('bœuf') || title.includes('poisson') || title.includes('saumon') || 
                            title.includes('thon') || title.includes('crevette') || title.includes('porc') || 
                            title.includes('lardon') || title.includes('saucisse') || title.includes('chorizo') || 
                            title.includes('canard');

            const isAccompagnement = (title.includes('accompagnement') || tags.includes('accompagnement') || 
                                     cat.includes('accompagnements') || cat.includes('accompagnement') || 
                                     title.includes('purée') || title.includes('frites') || title.includes('potatoes') ||
                                     title.includes('légume') || title.includes('pâtes') || title.includes('riz')) && !hasMeat;

            const isIceCream = (title.includes('glace') || title.includes('sorbet') || tags.includes('glace') || tags.includes('sorbet')) && 
                               !isSavory && !title.includes('glaçage') && !title.includes('gâteau');
            
            const isBeverage = (title.includes('boisson') || title.includes('cocktail') || title.includes('jus') || 
                              title.includes('alcool') || title.includes('vin') || title.includes('bière') ||
                              tags.includes('boisson') || tags.includes('cocktail') || tags.includes('jus')) && !isSavory;

            const isPatisserieKeyword = title.includes('gâteau') || title.includes('cake') || title.includes('cookie') || 
                                        title.includes('macaron') || title.includes('tarte') || title.includes('brioche') || 
                                        title.includes('pâte') || title.includes('choux') || title.includes('éclair') || 
                                        title.includes('millefeuille') || title.includes('viennoiserie') || title.includes('bambas') || 
                                        title.includes('brookie') || title.includes('financier') || title.includes('muffin') || 
                                        title.includes('brownie') || title.includes('fondant') || title.includes('moelleux') || 
                                        title.includes('madeleine') || title.includes('beignet') || title.includes('chouquette') || 
                                        title.includes('cupcake') || title.includes('galette') || title.includes('bûche') || 
                                        title.includes('babka') || title.includes('croissant') || title.includes('crumble') || 
                                        title.includes('clafoutis') || title.includes('pain d\'épices') || title.includes('charlotte');

            const isDessertKeyword = title.includes('tiramisu') || title.includes('mousse') || title.includes('crème') || 
                                     title.includes('compote') || title.includes('yaourt') || title.includes('panna cotta') || 
                                     title.includes('salade de fruit') || title.includes('verrine') || title.includes('flan') || 
                                     title.includes('crêpe') || title.includes('gaufre') || title.includes('pancake') || 
                                     title.includes('entremets') || title.includes('soufflé') || title.includes('profiterole') || 
                                     title.includes('churros') || title.includes('riz au lait') || title.includes('fondue') || 
                                     title.includes('chocolat') || title.includes('caramel') || title.includes('praliné') || 
                                     title.includes('fruit') || title.includes('pain perdu') || title.includes('pavlova') || 
                                     title.includes('nougat');

            let isPatisserie = false;
            let isDessert = false;
            
            if (!isSavory && !isIceCream && !isBeverage) {
                if (isPatisserieKeyword) {
                    isPatisserie = true;
                } else if (isDessertKeyword) {
                    isDessert = true;
                } else if (cat.includes('patisserie') || tags.includes('patisserie') || tags.includes('pâtisserie')) {
                    isPatisserie = true;
                } else if (cat.includes('dessert') || tags.includes('dessert') || title.includes('sucre')) {
                    isDessert = true;
                }
            }

            // Thèmes reconnus (normalisés en minuscules)
            const thematicTagsList = ['noël', 'noel', 'pâques', 'paques', 'halloween', 'saint-valentin', 'ramadan'];
            const foundThemeRaw = tags.find(t => thematicTagsList.includes(t));
            // Normalisation : 'noel' → 'noël', 'paques' → 'pâques'
            const foundTheme = foundThemeRaw === 'noel' ? 'noël'
                             : foundThemeRaw === 'paques' ? 'pâques'
                             : foundThemeRaw;

            let finalCat = (recipe.category || 'Autres').toLowerCase();

            // Détection automatique classique (catégorie principale)
            if (isIceCream) finalCat = 'glaces';
            else if (isBeverage) finalCat = 'boissons';
            else if (isPatisserie) finalCat = 'patisseries';
            else if (isDessert) finalCat = 'desserts';
            else if (isAccompagnement) finalCat = 'accompagnements';
            else if (isPlat) finalCat = 'plats';
            else if (isApero) finalCat = 'aperitifs';
            else if (isEntree) finalCat = 'entrees';
            else if (cat === 'simplissime') finalCat = 'simplissime';
            else if (cat === 'italie') finalCat = 'restaurant';
            else if (cat === 'restaurant') finalCat = 'restaurant';
            else if (cat === 'vegetarien') finalCat = 'vegetarien';

            // Push dans la catégorie principale
            if (!groups[finalCat]) groups[finalCat] = [];
            groups[finalCat].push(recipe);

            // Push AUSSI dans la section thématique si un tag thématique est trouvé
            if (foundTheme && foundTheme !== finalCat) {
                if (!groups[foundTheme]) groups[foundTheme] = [];
                groups[foundTheme].push(recipe);
            }
        });
        return groups;
    }, [filteredRecipes]);

    const newRecipes = useMemo(() => {
        return [...mockRecipes]
            .sort((a, b) => parseInt(b.id) - parseInt(a.id))
            .slice(0, 12);
    }, []);

    const categories = ['aperitifs', 'entrees', 'plats', 'desserts', 'patisserie', 'restaurant', 'vegetarien'];
    const categoryLabels: Record<string, string> = {
        'aperitifs': 'Apéro Gourmand',
        'entrees': 'Entrées Fraîches',
        'plats': 'Plats de Chef',
        'desserts': 'Douceurs Sucrées',
        'glaces': 'Les Glaces',
        'boissons': 'Rafraîchissements',
        'simplissime': 'Simplissime',
        'patisserie': 'Atelier de Pâtisserie',
        'restaurant': 'Comme au Resto',
        'vegetarien': 'Green & Healthy',
        'noël': 'Spécial Noël 🎄',
        'noel': 'Spécial Noël 🎄',
        'pâques': 'Spécial Pâques 🐣',
        'paques': 'Spécial Pâques 🐣',
        'halloween': 'Frissons d\'Halloween 🎃',
        'Autres': 'Le Reste du Monde'
    };

    const thematicThemes = [
        {
            id: 'theme-easter-2024',
            title: 'Pâques est là',
            description: 'Un délicieux plat d\'agneau Pascal.',
            image: 'images/themes/paques.jpg',
            category: 'plats',
            tags: ['Pâques'],
            isFavorite: false,
            difficulty: 'moyen',
            prepTime: 15,
            cookTime: 45,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-xmas-2024',
            title: 'C\'est Noël',
            description: 'La magie des fêtes dans votre assiette.',
            image: 'images/themes/noel.jpg',
            category: 'plats',
            tags: ['Noël'],
            isFavorite: false,
            difficulty: 'moyen',
            prepTime: 30,
            cookTime: 60,
            servings: 6,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-glaces',
            title: 'Les Glaces',
            description: 'Une sélection de sorbets et glaces artisanales.',
            image: 'images/themes/glaces.jpg',
            category: 'desserts',
            tags: ['glaces'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 0,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-refresh',
            title: 'Rafraîchissements',
            description: 'Des boissons fraîches pour tous les goûts.',
            image: 'images/themes/rafraichissements.jpg',
            category: 'boissons',
            tags: ['boissons'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 5,
            cookTime: 0,
            servings: 2,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-simplissime',
            title: 'Simplissime',
            description: 'Mini poivrons farcis à la grecque.',
            image: 'images/themes/simplissime.jpg',
            category: 'aperitifs',
            tags: ['simplissime'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 15,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-dolce-vita',
            title: 'La Dolce Vita',
            description: 'Boulettes de viandes ultra gourmandes.',
            image: 'images/themes/dolce-vita.jpg',
            category: 'plats',
            tags: ['italie'],
            isFavorite: false,
            difficulty: 'moyen',
            prepTime: 20,
            cookTime: 20,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-voila-lete',
            title: "Voilà l'Été ☀️",
            description: 'Les meilleures recettes estivales.',
            image: 'images/themes/voila-lete.jpg',
            category: 'plats',
            tags: ['voila-lete'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 0,
            servings: 6,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-cest-lhiver',
            title: "C'est l'Hiver ❄️",
            description: 'Recettes chaleureuses pour les jours froids.',
            image: 'images/themes/cest-lhiver.jpg',
            category: 'plats',
            tags: ['cest-lhiver'],
            isFavorite: false,
            difficulty: 'moyen',
            prepTime: 20,
            cookTime: 40,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-astuces',
            title: "Astuces 💡",
            description: 'Les petits secrets qui changent tout.',
            image: 'images/themes/astuces.jpg',
            category: 'autres',
            tags: ['Astuces'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 5,
            cookTime: 0,
            servings: 1,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-sauces',
            title: "Sauces",
            description: '',
            image: 'images/themes/sauces.png',
            category: 'sauces',
            tags: ['sauces'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 5,
            cookTime: 5,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-healthy',
            title: "Healthy",
            description: '',
            image: 'images/themes/healthy.png',
            category: 'vegetarien',
            tags: ['healthy'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 10,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-airfryer',
            title: "Airfryer",
            description: '',
            image: 'images/themes/airfryer.png',
            category: 'plats',
            tags: ['airfryer'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 5,
            cookTime: 15,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-barbecue',
            title: "Barbecue",
            description: '',
            image: 'images/themes/barbecue.png',
            category: 'plats',
            tags: ['barbecue'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 20,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-pas-cher',
            title: "Pas Cher",
            description: '',
            image: 'images/themes/pas-cher.png',
            category: 'plats',
            tags: ['pas cher'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 15,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-express',
            title: "Express",
            description: '',
            image: 'images/themes/express.png',
            category: 'plats',
            tags: ['express'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 5,
            cookTime: 5,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-famille',
            title: "Famille",
            description: '',
            image: 'images/themes/famille.png',
            category: 'plats',
            tags: ['famille'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 30,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-vege',
            title: "Végé",
            description: '',
            image: 'images/themes/vegetarien.png',
            category: 'vegetarien',
            tags: ['vegetarien'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 20,
            servings: 4,
            ingredients: [],
            steps: []
        }
    ];

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header
                    title={activeFiltersLabel}
                    large={!scrolled}
                />
                <MagicFilterBar
                    activeTags={activeTags}
                    onSelect={handleTagSelect}
                    isHome={true}
                />
            </div>

            <main 
                className={styles.main}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTags.join('-')}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                    >
                        {activeTags.length > 0 && (
                            <div className={styles.resultsWrapper}>
                                {activeTags.includes('thématiques') ? (
                                    <RecipeGrid
                                        recipes={thematicThemes as any}
                                        onRecipeClick={(recipe) => handleCarouselTitleClick(recipe.title)}
                                    />
                                ) : (
                                    <RecipeGrid
                                        recipes={filteredRecipes}
                                    />
                                )}
                            </div>
                        )}
                        {activeTags.length === 0 && (
                            <>
                                <RecipeCarousel
                                    recipes={thematicThemes as any}
                                    title="Thématiques du Moment"
                                    size="large"
                                    onTitleClick={handleCarouselTitleClick}
                                    onCardClick={(recipe) => handleCarouselTitleClick(recipe.title)}
                                />

                                <RecipeCarousel
                                    recipes={newRecipes}
                                    title="Les Nouveautés"
                                    size="small"
                                    onTitleClick={handleCarouselTitleClick}
                                />

                                <div className={styles.sectionsContainer}>
                                    {categorizedRecipes['aperitifs']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['aperitifs']}
                                            title="Apéritifs"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['entrees']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['entrees']}
                                            title="Entrées"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['plats']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['plats']}
                                            title="Plats"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['accompagnements']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['accompagnements']}
                                            title="Accompagnements"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['desserts']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['desserts']}
                                            title="Desserts"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['patisseries']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['patisseries']}
                                            title="Pâtisseries"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                </div>
                            </>
                        )}

                        {filteredRecipes.length === 0 && (
                            <div className={styles.noRecipes}>Aucune recette correspondante 🥣</div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
