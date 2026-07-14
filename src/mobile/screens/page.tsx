'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Header from '../components/Header/Header';
import RecipeCarousel from '../components/RecipeCarousel/RecipeCarousel';
import RecipeGrid from '../components/RecipeGrid/RecipeGrid';
import TopRatedCarousel from '../components/TopRatedCarousel/TopRatedCarousel';
import RequestRecipeButton from '../components/RequestRecipeButton/RequestRecipeButton';
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
    const touchStartRef = useRef<number>(0);
    const touchEndRef = useRef<number>(0);
    const [recentlyViewed, setRecentlyViewed] = useState<typeof mockRecipes>([]);
    // Sections calculées (Mieux Notées, Dernières Vues, Nouveautés) : leur contenu ne
    // découle pas d'un tag, on affiche donc la liste exacte du carrousel.
    const [collection, setCollection] = useState<{ title: string; recipes: any[] } | null>(null);

    const openCollection = (title: string, recipes: any[]) => {
        setActiveFilters([]);
        setCollection({ title, recipes });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        const load = () => {
            try {
                const ids: string[] = JSON.parse(localStorage.getItem('recently-viewed') || '[]').map((r: any) => r.id || r);
                const recipes = ids.map(id => mockRecipes.find(r => String(r.id) === String(id))).filter(Boolean) as typeof mockRecipes;
                setRecentlyViewed(recipes);
            } catch {}
        };
        load();
        // PAS de re-tri live : ouvrir une carte récemment-vue réordonne la liste, ce qui
        // remonterait la carte en plein clic (carte qui clignote/tourne). On recharge
        // seulement au remontage de l'accueil (retour sur la page).
    }, []);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleTagSelect = (tag: string, groupId?: string) => {
        setCollection(null);
        if (!groupId) {
            const lowerTag = tag.toLowerCase();
            const categoriesIds = ['aperitifs', 'entrees', 'plats', 'vegetarien', 'desserts', 'patisserie', 'restaurant', 'apéro', 'entrée'];
            const countriesIds = ['france', 'italie', 'espagne', 'grece', 'liban', 'usa', 'mexique', 'orient', 'asie', 'afrique'];
            
            if (categoriesIds.some(c => lowerTag.includes(c))) groupId = 'categories';
            else if (countriesIds.some(c => lowerTag.includes(c))) groupId = 'countries';
            else groupId = 'trends'; 
        }

        // REMPLACER tous les filtres (ne pas empiler) — comme desktop : une seule
        // catégorie active à la fois. Re-cliquer le tag actif le désélectionne.
        setActiveFilters(prev => {
            if (prev.length === 1 && prev[0].tag === tag) return [];
            return [{ tag, group: groupId }];
        });
    };

    // Applique un filtre passé en URL (?tag=...) au chargement (ex. clic depuis une
    // sous-catégorie Restaurant sur une autre page → /?tag=resto-italien).
    useEffect(() => {
        try {
            const t = new URLSearchParams(window.location.search).get('tag');
            if (t) handleTagSelect(t);
        } catch { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCarouselTitleClick = (title: string) => {
        const cleanTitle = title.replace(/[^\w\sàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/g, '').toLowerCase().trim();
        
        const mapping: Record<string, string> = {
            'thématiques du moment': 'thématiques',
            'thématiques': 'thématiques',
            'nouveautés': 'nouveautés',
            'les nouveautés': 'nouveautés',
            'spécial pâques': 'pâques',
            'pâques': 'pâques',
            'apéro gourmand': 'aperitifs',
            'apéritifs': 'aperitifs',
            'entrées fraîches': 'entrees',
            'entrées': 'entrees',
            'plats de chef': 'plats',
            'plats': 'plats',
            'douceurs sucrées': 'desserts',
            'desserts': 'desserts',
            'atelier de pâtisserie': 'patisserie',
            'pâtisserie': 'patisserie',
            'pâtisseries': 'patisserie',
            'comme au resto': 'restaurant',
            'restaurant': 'restaurant',
            'green healthy': 'vegetarien',
            'végé': 'vegetarien',
            'vege': 'vegetarien',
            'noël': 'noël',
            'cest noël': 'noël',
            'cest noel': 'noël',
            'pâques est là': 'pâques',
            'paques est la': 'pâques',
            'la dolce vita': 'dolce-vita',
            'dolce vita': 'dolce-vita',
            'voilà lété': 'voila-lete',
            'voila lete': 'voila-lete',
            'cest lhiver': 'cest-lhiver',
            'cest lhiver ': 'cest-lhiver',
            'astuces': 'Astuces',
            'les glaces': 'glaces',
            'glaces': 'glaces',
            'rafraîchissements': 'boissons',
            'boissons': 'boissons',
            'sauces': 'sauces',
            'poissons et crustacés': 'poissons',
            'poissons et crustaces': 'poissons',
            'sandwichs': 'sandwich',
            'sandwich': 'sandwich',
            'healthy': 'healthy',
            'airfryer': 'airfryer',
            'barbecue': 'barbecue',
            'pas cher': 'pas cher',
            'express': 'express',
            'famille': 'famille',
            'accompagnements': 'accompagnements',
            'pâtes': 'pates',
            'pates': 'pates',
            'pasta': 'pates'
        };

        const tag = mapping[cleanTitle] || cleanTitle;
        handleTagSelect(tag);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const clearAllFilters = () => {
        setActiveFilters([]);
        setCollection(null);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = e.targetTouches[0].clientX;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        touchEndRef.current = e.targetTouches[0].clientX;
    };

    const handleTouchEnd = () => {
        if (touchStartRef.current < 100 && (touchEndRef.current - touchStartRef.current) > 100) {
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
                const descriptionLower = (recipe.description || '').toLowerCase();
                const fullText = `${titleLower} ${descriptionLower} ${(recipe.steps || []).join(' ')} ${(recipe.ingredients || []).map(i => i.name).join(' ')}`.toLowerCase();

                if (tagLower === 'boissons') {
                    return recipeCat === 'boissons' || recipeTags.some(t => t.includes('boisson') || t.includes('cocktail') || t.includes('jus') || t.includes('rafra')) ||
                           ['boisson', 'cocktail', 'jus', 'smoothie', 'mojito', 'limonade', 'café', 'thé'].some(k => titleLower.includes(k));
                }

                if (tagLower === 'vegetarien') {
                    if (recipeTags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || recipeCat === 'vegetarien') return true;
                    const meatKeywords = ['poulet', 'bœuf', 'boeuf', 'porc', 'veau', 'agneau', 'canard', 'dinde', 'saucisse', 'chorizo', 'lardon', 'jambon', 'poisson', 'saumon', 'thon', 'crevette', 'cabillaud', 'fruits de mer'];
                    const hasMeat = meatKeywords.some(meat => fullText.includes(meat));
                    const isSweet = ['gâteau', 'cake', 'tarte', 'chocolat', 'sucre', 'dessert', 'patisserie', 'glace'].some(s => titleLower.includes(s)) || ['desserts', 'patisserie', 'glaces'].includes(recipeCat);
                    return !hasMeat && !isSweet;
                }

                if (tagLower === 'glaces') {
                    return recipeCat === 'glaces' || recipeTags.some(t => t.includes('glace') || t.includes('sorbet')) ||
                           ['glace', 'sorbet', 'crème glacée', 'bûche glacée'].some(k => titleLower.includes(k));
                }

                if (tagLower === 'famille' || tagLower === 'familial') {
                    if (recipeTags.some(t => t.toLowerCase() === 'famille' || t.toLowerCase() === 'familial') || titleLower.includes('familial') || titleLower.includes('famille')) return true;
                    return fullText.includes('four') && (recipe.servings || 0) >= 4 && !['desserts', 'patisserie', 'glaces', 'boissons', 'aperitifs', 'sauces'].includes(recipeCat);
                }

                if (tagLower === 'express') {
                    if (recipeTags.some(t => t.toLowerCase() === 'express' || t.toLowerCase() === 'rapide') || titleLower.includes('express') || titleLower.includes('rapide')) return true;
                    const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);
                    return totalTime > 0 && totalTime <= 30 && !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
                }

                if (tagLower === 'pas cher' || tagLower === 'pas-cher') {
                    if (recipeTags.some(t => t.toLowerCase() === 'pas cher' || t.toLowerCase() === 'pas-cher') || titleLower.includes('pas cher')) return true;
                    const cheapKeywords = ['pâtes', 'pasta', 'riz', 'pommes de terre', 'patate', 'oeuf', 'œuf', 'lentilles', 'haricots'];
                    const expensiveKeywords = ['bœuf', 'boeuf', 'agneau', 'saumon', 'truffe', 'caviar', 'foie gras', 'veau'];
                    const hasCheap = cheapKeywords.some(k => titleLower.includes(k) || fullText.includes(k));
                    const hasExpensive = expensiveKeywords.some(k => fullText.includes(k));
                    return hasCheap && !hasExpensive && !['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat);
                }

                if (tagLower === 'thématiques') {
                    return recipeTags.some(t => t.toLowerCase() === 'thématiques' || t.toLowerCase() === 'thematique');
                }

                if (tagLower === 'nouveautés') {
                    // Les nouveautés = les 12 premières recettes non-restaurant (= plus récemment modifiées dans WP)
                    const newIds = new Set(
                        mockRecipes.filter(r => r.category !== 'restaurant').slice(0, 12).map(r => String(r.id))
                    );
                    return newIds.has(String(recipe.id));
                }

                if (tagLower === 'accompagnements') {
                    return recipeCat === 'accompagnements' || recipeCat === 'accompagnement' ||
                           recipeTags.some(t => t === 'accompagnement' || t === 'accompagnements');
                }

                if (tagLower === 'pates') {
                    const pastaKeywords = ['pâtes', 'pasta', 'spaghetti', 'tagliatelle', 'linguine', 'penne', 'rigatoni', 'lasagne', 'gnocchi', 'fettuccine', 'carbonara', 'bolognese', 'bolognaise', 'tortellini', 'ravioli', 'macaroni'];
                    return recipeTags.some(t => t === 'pates' || t === 'pâtes') ||
                           recipeCat === 'pates' ||
                           pastaKeywords.some(k => recipe.title.toLowerCase().includes(k));
                }

                // Dolce Vita = recettes italiennes
                if (tagLower === 'dolce-vita') {
                    return recipeTags.some(t => t.toLowerCase() === 'italie' || t.toLowerCase() === 'italy') ||
                           recipeCat === 'italie';
                }

                // Pâques & Noël — tag exact OU mention dans le texte
                if (tagLower === 'pâques' || tagLower === 'paques') {
                    return recipeTags.some(t => /p[âa]ques/i.test(t)) || /p[âa]ques/i.test(fullText);
                }
                if (tagLower === 'noël' || tagLower === 'noel') {
                    return recipeTags.some(t => /no[eë]l/i.test(t)) || /no[eë]l/i.test(fullText);
                }

                // Pour les thèmes (sauces, airfryer, barbecue, etc.) : uniquement par tag explicite ou catégorie
                const strictThemes = ['sauces', 'airfryer', 'barbecue', 'healthy', 'simplissime', 'voila-lete', 'cest-lhiver', 'astuces'];
                if (strictThemes.includes(tagLower)) {
                    // Barbecue : exclure les sauces (elles ont leur propre section)
                    if (tagLower === 'barbecue' && recipeTags.some(t => t.toLowerCase() === 'sauces')) return false;
                    // voila-lete / cest-lhiver : tag explicite OU mots-clés dans le texte
                    if (tagLower === 'voila-lete') {
                        return recipeTags.some(t => /voila.?l.?[eé]t[eé]/i.test(t) || t.toLowerCase() === 'voila-lete' || /[eé]t[eé]|estival|barbecue|soleil|frais/i.test(t))
                            || /[eé]t[eé]|estival|barbecue|soleil|grillad/i.test(titleLower);
                    }
                    if (tagLower === 'cest-lhiver') {
                        return recipeTags.some(t => /hiver|hivernal|chaud|r[eé]confort/i.test(t) || t.toLowerCase() === 'cest-lhiver')
                            || /hiver|hivernal|chaud|r[eé]confort|mijoté|fondue/i.test(titleLower);
                    }
                    return recipeCat === tagLower || recipeTags.some(t => t.toLowerCase() === tagLower);
                }

                // Thèmes "type de plat" : matching tag explicite OU mot-clé (singulier/pluriel) dans titre/desc/tags
                const lowerTags = recipeTags.map(t => t.toLowerCase());
                if (tagLower === 'salades') {
                    return lowerTags.some(t => t.startsWith('salade')) || /\bsalade(s)?\b/.test(fullText);
                }
                if (tagLower === 'soupes') {
                    return lowerTags.some(t => t.startsWith('soupe')) ||
                        /\b(soupe(s)?|velout[ée](s)?|gaspacho|potage|minestrone|ramen)\b/.test(titleLower);
                }
                if (tagLower === 'gratins') {
                    return lowerTags.some(t => t.startsWith('gratin')) || /\bgratin(s|[ée]e?)?\b/.test(fullText);
                }
                if (tagLower === 'epice' || tagLower === 'épicé') {
                    return lowerTags.some(t => /^[ée]pic/.test(t)) ||
                        /\b([ée]pic[ée]?|piquant|piment|harissa|sambal|sriracha|jalape[ñn]o|habanero|chili)\b/.test(fullText);
                }
                // Tarte : tartes (salées + sucrées), quiches et pizzas
                if (tagLower === 'tarte' || tagLower === 'tartes') {
                    return recipeTags.some(t => /\b(tarte|quiche|pizza)/.test(t)) ||
                           /\b(tarte(let)?(te)?s?|quiches?|pizz?as?|pissaladi[èe]re|flammenk[uü]che|tourtes?)\b/.test(titleLower);
                }
                // Poissons et crustacés : tag explicite OU produit de la mer dans le titre
                if (tagLower === 'poissons' || tagLower === 'poissons et crustacés') {
                    return lowerTags.some(t => /poisson|crustac|fruits de mer/.test(t)) ||
                        /\b(poissons?|saumon|thon|cabillaud|colin|merlu|lieu|dorade|daurade|sardines?|maquereau|truite|sole|bar\b|loup de mer|crevettes?|gambas|moules?|saint[- ]jacques|st[- ]jacques|crabe|homard|langoustines?|calamars?|encornets?|poulpe|seiche|hu[îi]tres?|fruits de mer|crustac[ée]s?)\b/.test(titleLower);
                }
                // Sandwichs : tag explicite OU type de sandwich dans le titre
                if (tagLower === 'sandwich' || tagLower === 'sandwichs') {
                    return lowerTags.some(t => t.startsWith('sandwich')) ||
                        /\b(sandwichs?|burgers?|wraps?|paninis?|croque[- ](monsieur|madame)|bagels?|hot[- ]dogs?|kebab|pita|club|tacos|pan bagnat)\b/.test(titleLower);
                }
                // ── RÉGIMES (heuristique par ingrédients/texte) ──
                if (tagLower === 'sans-gluten') {
                    if (recipeTags.some(t => /sans[\s-]?gluten/.test(t))) return true;
                    const gluten = ['blé', 'farine', 'pâtes', 'pates', 'pâte feuilletée', 'pâte brisée', 'pâte sablée', 'pain', 'chapelure', 'panko', 'semoule', 'boulgour', 'couscous', 'biscuit', 'spéculoos', 'speculoos', 'boudoir', 'sauce soja', 'seigle', 'orge', 'épeautre', 'pizza', 'gnocchi', 'lasagne', 'raviolis', 'nouilles', 'vermicelle', 'croûton', 'crouton', 'brioche', 'crêpe', 'crepe', 'gaufre', 'cookie', 'muffin', 'gâteau', 'gateau', 'cake', 'tarte', 'quiche'];
                    return !gluten.some(k => fullText.includes(k));
                }
                if (tagLower === 'sans-lactose') {
                    if (recipeTags.some(t => /sans[\s-]?lactose/.test(t))) return true;
                    const dairy = ['lait', 'beurre', 'crème', 'creme', 'fromage', 'yaourt', 'yogourt', 'mozzarella', 'parmesan', 'mascarpone', 'ricotta', 'feta', 'comté', 'comte', 'gruyère', 'gruyere', 'emmental', 'cheddar', 'chèvre', 'chevre', 'burrata', 'béchamel', 'bechamel', 'raclette', 'boursin', 'petit-suisse'];
                    const txt = fullText.replace(/lait (de |d')(coco|amande|soja|avoine|riz|noisette)/g, '');
                    return !dairy.some(k => txt.includes(k));
                }
                if (tagLower === 'sans-sucre') {
                    if (recipeTags.some(t => /sans[\s-]?sucre/.test(t))) return true;
                    if (['desserts', 'patisserie', 'glaces', 'boissons'].includes(recipeCat)) return false;
                    const sugar = ['sucre', 'cassonade', 'miel', 'sirop', 'confiture', 'chocolat', 'nutella', 'caramel', 'pâte à tartiner', 'pate a tartiner', 'glucose', 'agave'];
                    return !sugar.some(k => fullText.includes(k));
                }
                if (tagLower === 'sans-sel') {
                    if (recipeTags.some(t => /sans[\s-]?sel/.test(t))) return true;
                    const salty = ['sel', 'sauce soja', 'bouillon', 'lardon', 'jambon', 'charcuterie', 'chorizo', 'saucisse', 'olive', 'cornichon', 'câpre', 'capre', 'anchois', 'feta', 'parmesan', 'roquefort', 'fumé', 'fume', 'saumure', 'moutarde', 'ketchup'];
                    return !salty.some(k => fullText.includes(k));
                }
                if (tagLower === 'minceur') {
                    if (recipeTags.some(t => /minceur|l[ée]ger|hypocalorique/.test(t))) return true;
                    if (['desserts', 'patisserie', 'glaces', 'boissons', 'sauces'].includes(recipeCat)) return false;
                    const light = ['salade', 'légume', 'legume', 'vapeur', 'grillé', 'grille', 'poêlée', 'poelee', 'courgette', 'brocoli', 'haricot vert', 'poisson', 'blanc de poulet', 'crudité', 'crudite', 'bowl', 'soupe', 'velouté', 'veloute'];
                    const heavy = ['frit', 'friture', 'beurre', 'crème fraîche', 'creme fraiche', 'fromage fondu', 'raclette', 'tartiflette', 'gratin', 'burger', 'pizza', 'mayonnaise', 'lardon', 'pâte feuilletée', 'pate feuilletee', 'crème liquide'];
                    return light.some(k => fullText.includes(k)) && !heavy.some(k => fullText.includes(k));
                }

                const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
                const normTag = norm(tagLower);
                return fullText.includes(tagLower) || norm(fullText).includes(normTag) ||
                    recipeCat === tagLower || norm(recipeCat) === normTag ||
                    recipeTags.some(t => t.toLowerCase() === tagLower || norm(t.toLowerCase()) === normTag);
            });
        });
    }, [activeTags]);

    const activeFiltersLabel = useMemo(() => {
        if (collection) return collection.title;
        if (activeTags.length === 0) return 'Tous nos secrets';
        return activeTags.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ');
    }, [activeTags, collection]);

    const categorizedRecipes = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredRecipes.forEach(recipe => {
            const cat = recipe.category?.toLowerCase();
            const tags = (recipe.tags || []).map(t => t.toLowerCase());
            const title = recipe.title.toLowerCase();

            const themes = ['glaces', 'boissons', 'Astuces', 'Noël', 'pâques', 'italie', 'orient', 'asie', 'mexique', 'usa', 'healthy', 'airfryer', 'barbecue', 'express', 'famille', 'pas cher', 'sauces'];
            const foundTheme = themes.find(t => tags.includes(t.toLowerCase()) || title.includes(t.toLowerCase()));

            let finalCat = cat;
            // pâtes en priorité (souvent catégorisées "plats" dans WP)
            const pastaKw = ['pâtes', 'pasta', 'spaghetti', 'tagliatelle', 'linguine', 'penne', 'rigatoni', 'lasagne', 'gnocchi', 'fettuccine', 'carbonara', 'bolognaise', 'tortellini', 'ravioli', 'macaroni'];
            if (cat === 'pates' || tags.includes('pates') || tags.includes('pâtes') || pastaKw.some(k => title.includes(k))) finalCat = 'pates';
            // accompagnement en priorité car les recettes sont souvent catégorisées "plats" dans WP
            else if (cat === 'accompagnements' || cat === 'accompagnement' || tags.includes('accompagnement') || tags.includes('accompagnements')) finalCat = 'accompagnements';
            else if (cat === 'aperitifs' || cat === 'apéro' || tags.includes('apéro')) finalCat = 'aperitifs';
            else if (cat === 'entrees' || cat === 'entrée' || tags.includes('entrée')) finalCat = 'entrees';
            else if (cat === 'plats' || cat === 'plat' || tags.includes('plat')) finalCat = 'plats';
            else if (cat === 'desserts' || cat === 'dessert' || tags.includes('dessert')) finalCat = 'desserts';
            else if (cat === 'patisserie' || cat === 'pâtisserie' || tags.includes('patisserie')) finalCat = 'patisserie';
            else if (cat === 'restaurant' || cat === 'italie' || title.includes('chef') || title.includes('resto') || tags.includes('restaurant')) finalCat = 'restaurant';
            else if (cat === 'vegetarien') finalCat = 'vegetarien';

            if (!groups[finalCat]) groups[finalCat] = [];
            groups[finalCat].push(recipe);

            if (foundTheme && foundTheme !== finalCat) {
                if (!groups[foundTheme]) groups[foundTheme] = [];
                groups[foundTheme].push(recipe);
            }
            
            // Groupe spécial pour toutes les thématiques
            if (tags.some(t => themes.map(th => th.toLowerCase()).includes(t)) || tags.includes('thématiques')) {
                if (!groups['thématiques']) groups['thématiques'] = [];
                groups['thématiques'].push(recipe);
            }
        });
        return groups;
    }, [filteredRecipes]);

    const newRecipes = useMemo(() => {
        // Les 12 premières recettes de mockData = les plus récemment modifiées dans WP (orderby=modified)
        // C'est là qu'apparaissent les dernières recettes lancées depuis TikTok
        return mockRecipes
            .filter(r => r.category !== 'restaurant')
            .slice(0, 12);
    }, []);

    const thematicThemes = [
        {
            id: 'theme-airfryer',
            title: "Airfryer",
            description: 'La cuisine croustillante et saine.',
            image: '/images/themes/airfryer.png?v=2',
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
            description: 'Le goût authentique de la braise.',
            image: '/images/themes/barbecue.png?v=2',
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
            id: 'theme-healthy',
            title: "Healthy",
            description: 'Manger bien, se sentir bien.',
            image: '/images/themes/healthy.png?v=2',
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
            id: 'theme-pas-cher',
            title: "Pas Cher",
            description: 'Cuisiner malin à petit prix.',
            image: '/images/themes/pas-cher.png?v=2',
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
            description: 'Prêt en un clin d\'œil.',
            image: '/images/themes/express.png?v=2',
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
            description: 'Pour les grandes tablées.',
            image: '/images/themes/famille.png?v=2',
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
            description: 'Le végétal à l\'honneur.',
            image: '/images/themes/vegetarien.png?v=2',
            category: 'vegetarien',
            tags: ['vegetarien'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 20,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-easter-2024',
            title: 'Pâques est là',
            description: 'Un délicieux plat d\'agneau Pascal.',
            image: '/images/themes/paques.jpg?v=2',
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
            image: '/images/themes/noel.jpg?v=2',
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
            image: '/images/themes/glaces.jpg?v=2',
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
            image: '/images/themes/rafraichissements.jpg?v=2',
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
            image: '/images/themes/simplissime.jpg?v=2',
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
            image: '/images/themes/dolce-vita.jpg?v=2',
            category: 'plats',
            tags: ['dolce-vita'],
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
            title: "Voilà l'Été",
            description: 'Les meilleures recettes estivales.',
            image: '/images/themes/voila-lete.jpg?v=2',
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
            title: "C'est l'Hiver",
            description: 'Recettes chaleureuses pour les jours froids.',
            image: '/images/themes/cest-lhiver.jpg?v=2',
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
            title: "Astuces",
            description: 'Les petits secrets qui changent tout.',
            image: '/images/themes/astuces.jpg?v=2',
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
            image: '/images/themes/sauces.png?v=2',
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
            id: 'theme-pates',
            title: "Pâtes",
            description: 'Spaghettis, gnocchis, lasagnes et toutes les pâtes.',
            image: '/images/themes/pates.jpg?v=1',
            category: 'plats',
            tags: ['pates'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 15,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-epice',
            title: "Épicé",
            description: 'Recettes relevées pour les amateurs de piquant.',
            image: '/images/themes/epice.png?v=1',
            category: 'plats',
            tags: ['epice'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 20,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-salades',
            title: "Salades",
            description: 'Fraîcheur, croquant et couleurs dans l’assiette.',
            image: '/images/themes/salades.png?v=1',
            category: 'entrees',
            tags: ['salades'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 0,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-soupes',
            title: "Soupes",
            description: 'Réconfortantes, veloutées, mijotées avec amour.',
            image: '/images/themes/soupes.png?v=1',
            category: 'plats',
            tags: ['soupes'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 10,
            cookTime: 30,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-gratins',
            title: "Gratins",
            description: 'Le fondant gratiné qui fait l’unanimité.',
            image: '/images/themes/gratins.png?v=1',
            category: 'plats',
            tags: ['gratins'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 15,
            cookTime: 35,
            servings: 4,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-tarte',
            title: "Tarte",
            description: 'Tartes, quiches et pizzas dorées au four.',
            image: '/images/themes/tarte.svg?v=1',
            category: 'plats',
            tags: ['tarte'],
            isFavorite: false,
            difficulty: 'facile',
            prepTime: 20,
            cookTime: 30,
            servings: 6,
            ingredients: [],
            steps: []
        },
        {
            id: 'theme-poissons-crustaces', title: 'Poissons et crustacés', description: 'La fraîcheur de la mer dans l\'assiette.',
            image: '/images/themes/poissons-crustaces.svg', category: 'plats', tags: ['poissons'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 15, servings: 4, ingredients: [], steps: []
        },
        {
            id: 'theme-sandwichs', title: 'Sandwichs', description: 'Généreux, gourmands, à dévorer.',
            image: '/images/themes/sandwichs.svg', category: 'plats', tags: ['sandwich'],
            isFavorite: false, difficulty: 'facile', prepTime: 10, cookTime: 5, servings: 2, ingredients: [], steps: []
        },
        {
            id: 'theme-sans-gluten', title: 'Sans gluten', description: 'Des recettes gourmandes sans gluten.',
            image: '/images/themes/sans-gluten.svg?v=1', category: 'plats', tags: ['sans-gluten'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 20, servings: 4, ingredients: [], steps: []
        },
        {
            id: 'theme-sans-lactose', title: 'Sans lactose', description: 'Cuisiner sans produits laitiers.',
            image: '/images/themes/sans-lactose.svg?v=1', category: 'plats', tags: ['sans-lactose'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 20, servings: 4, ingredients: [], steps: []
        },
        {
            id: 'theme-sans-sucre', title: 'Sans sucre', description: 'Le plaisir sans sucre ajouté.',
            image: '/images/themes/sans-sucre.svg?v=1', category: 'plats', tags: ['sans-sucre'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 20, servings: 4, ingredients: [], steps: []
        },
        {
            id: 'theme-sans-sel', title: 'Sans sel', description: 'Savoureux et pauvre en sel.',
            image: '/images/themes/sans-sel.svg?v=1', category: 'plats', tags: ['sans-sel'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 20, servings: 4, ingredients: [], steps: []
        },
        {
            id: 'theme-minceur', title: 'Minceur', description: 'Léger, frais et équilibré.',
            image: '/images/themes/minceur.svg?v=1', category: 'plats', tags: ['minceur'],
            isFavorite: false, difficulty: 'facile', prepTime: 15, cookTime: 15, servings: 4, ingredients: [], steps: []
        },
    ].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }));

    return (
        <div className={styles.page}>
            <div className={styles.stickyHeaderMenu}>
                <Header
                    title={activeFiltersLabel}
                    large={!scrolled}
                    onClear={clearAllFilters}
                    showClear={activeTags.length > 0 || !!collection}
                />
                <MagicFilterBar
                    activeTags={activeTags}
                    onSelect={handleTagSelect}
                    isHome={true}
                />
                <RequestRecipeButton />
            </div>

            <main 
                className={styles.main}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={collection ? `collection-${collection.title}` : activeTags.join('-')}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.4 }}
                    >
                        {collection && (
                            <div className={styles.resultsWrapper}>
                                <RecipeGrid recipes={collection.recipes} />
                            </div>
                        )}
                        {!collection && activeTags.length > 0 && (
                            <div className={styles.resultsWrapper}>
                                {activeTags.includes('thématiques') ? (
                                    <RecipeGrid
                                        recipes={thematicThemes as any}
                                        onRecipeClick={(recipe) => {
                                            const tag = (recipe as any).tags?.[0];
                                            if (tag) { handleTagSelect(tag); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                                            else handleCarouselTitleClick(recipe.title);
                                        }}
                                    />
                                ) : (
                                    <RecipeGrid
                                        recipes={filteredRecipes}
                                    />
                                )}
                            </div>
                        )}
                        {!collection && activeTags.length === 0 && (
                            <div className={styles.sectionsContainer}>
                                {categorizedRecipes['thématiques']?.length > 0 && (
                                    <RecipeCarousel
                                        recipes={[
                                            { id: 't-main', title: 'Thématiques', image: '/images/categories/thematiques.jpg?v=7', tags: ['thématiques'] } as any,
                                            ...thematicThemes
                                        ]}
                                        title="Thématiques du Moment"
                                        compact={true}
                                        onTitleClick={handleCarouselTitleClick}
                                        onCardClick={(recipe) => {
                                            const tag = (recipe as any).tags?.[0];
                                            if (tag && tag !== 'thématiques') { handleTagSelect(tag); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                                            else handleCarouselTitleClick(recipe.title);
                                        }}
                                    />
                                )}
                                    <TopRatedCarousel
                                        recipes={mockRecipes}
                                        limit={10}
                                        onTitleClick={openCollection}
                                    />
                                    {recentlyViewed.length > 0 && (
                                        <RecipeCarousel
                                            recipes={recentlyViewed}
                                            title="Les Dernières Vues"
                                            size="small"
                                            onTitleClick={(title) => openCollection(title, recentlyViewed)}
                                        />
                                    )}
                                    {newRecipes.length > 0 && (
                                        <RecipeCarousel
                                            recipes={newRecipes}
                                            title="Nouveautés"
                                            size="small"
                                            onTitleClick={(title) => openCollection(title, newRecipes)}
                                        />
                                    )}
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
                                    {categorizedRecipes['patisserie']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['patisserie']}
                                            title="Pâtisseries"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                    {categorizedRecipes['restaurant']?.length > 0 && (
                                        <RecipeCarousel
                                            recipes={categorizedRecipes['restaurant']}
                                            title="Comme au Resto"
                                            size="small"
                                            onTitleClick={handleCarouselTitleClick}
                                        />
                                    )}
                                </div>
                        )}

                        {filteredRecipes.length === 0 && ( activeTags.length > 0 ) && (
                            <div className={styles.noRecipes}>Aucune recette correspondante 🥣</div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    );
}
