import { Recipe } from '@/types';

export function getSmartCategory(recipe: Recipe): string {
    const title = (recipe.title || "").toLowerCase();
    const tags = (recipe.tags || []).map(t => t.toLowerCase());
    const originalCat = (recipe.category || "").toLowerCase();

    // 1. Détection du type de plat (Salé vs Sucré)
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

    // 2. Classifications spécifiques
    const isPlat = title.includes('poulet') || title.includes('agneau') || title.includes('gratin') || 
                  title.includes('burger') || title.includes('viande') || title.includes('pâtes') ||
                  title.includes('riz') || title.includes('rôti') || title.includes('confit') ||
                  tags.includes('plat') || originalCat.includes('plat') || originalCat.includes('plats');
    
    const isApero = title.includes('croquetas') || title.includes('apéro') || title.includes('tapas') || 
                  title.includes('cocktail') || tags.includes('aperitif') || tags.includes('apéro') ||
                  originalCat.includes('aperitifs') || originalCat.includes('apéro') || title.includes('houmous');

    const isEntree = title.includes('salade') || title.includes('soupe') || title.includes('velouté') ||
                   title.includes('œuf') || title.includes('entrée') || tags.includes('entrée') ||
                   originalCat.includes('entrees') || originalCat.includes('entrée') || title.includes('carpaccio');

    const isPatisserie = (title.includes('gâteau') || title.includes('cake') || title.includes('tarte sucrée') || 
                        title.includes('cookie') || title.includes('muffins') || title.includes('pâtisserie') ||
                        originalCat.includes('patisserie')) && !isSavory;

    const isDessert = (title.includes('chocolat') || title.includes('sucre') || 
                     title.includes('fruit') || title.includes('tiramisu') || title.includes('crème') ||
                     title.includes('mousse') || title.includes('yaourt') || title.includes('sorbet') ||
                     title.includes('glace') || originalCat.includes('dessert')) && !isSavory && !isPatisserie;

    // Priorité de retour
    if (isApero) return "Apéritifs";
    if (isEntree) return "Entrées";
    if (isPlat) return "Plats";
    if (isPatisserie) return "Pâtisserie";
    if (isDessert) return "Desserts";
    
    // Fallback propre
    if (originalCat.includes('plats')) return "Plats";
    if (originalCat.includes('aperitif')) return "Apéritifs";
    if (originalCat.includes('dessert')) return "Desserts";
    
    return recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1);
}
