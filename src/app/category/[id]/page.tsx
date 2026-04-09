import { mockRecipes } from '@/data/mockData';
import CategoryClient from './CategoryClient';
import { notFound } from 'next/navigation';

const categories = {
    'aperitifs': { name: 'Apéritifs', icon: '🍹' },
    'entrees': { name: 'Entrées', icon: '🥗' },
    'plats': { name: 'Plats', icon: '🍲' },
    'vegetarien': { name: 'Végétarien', icon: '🥬' },
    'desserts': { name: 'Desserts', icon: '🍰' },
    'patisserie': { name: 'Pâtisserie', icon: '🥐' },
    'restaurant': { name: 'Restaurant', icon: '🍽️' },
    'voila-lete': { name: "Voilà l'Été ☀️", icon: '☀️' },
    'cest-lhiver': { name: "C'est l'Hiver ❄️", icon: '❄️' },
    'glaces': { name: 'Les Glaces 🍨', icon: '🍨' },
    'rafraichissements': { name: 'Rafraîchissements 🥤', icon: '🥤' },
    'noel': { name: "C'est Noël 🎄", icon: '🎄' },
    'paques': { name: 'Pâques 🐣', icon: '🐣' },
    'simplissime': { name: 'Simplissime ⚡', icon: '⚡' }
};

export default function CategoryPage({ params }: { params: { id: string } }) {
    const id = params.id;
    const category = categories[id as keyof typeof categories];

    if (!category) {
        notFound();
    }

    // Filtrage robuste des recettes comme sur la Home
    const recipes = mockRecipes.filter(r => {
        if (!r) return false;
        
        const title = (r.title || "").toLowerCase();
        const tags = r.tags?.map(t => t.toLowerCase()) || [];
        const cat = r.category?.toLowerCase() || "";
        const catId = id.toLowerCase();
        
        // 1. Logique Spéciale : catégories par TAG (thématiques saisonnières)
        if (catId === 'vegetarien') {
            return tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || 
                   cat.includes('vegetarien') || 
                   title.includes('végé') || title.includes('vgt');
        }
        if (catId === 'voila-lete') {
            const summerKeywords = ['été', 'ete', 'voilà', 'voila-lete', 'salade', 'bbq', 'barbecue', 'grillade', 'plancha'];
            return cat === 'voila-lete' || 
                   tags.some(t => summerKeywords.some(k => t.toLowerCase().includes(k))) ||
                   summerKeywords.some(k => title.toLowerCase().includes(k));
        }
        if (catId === 'cest-lhiver') {
            const winterKeywords = ['hiver', "c'est l'hiver", 'cest-lhiver', 'soupe', 'velouté', 'gratin', 'four', 'réconfortant', 'familial', 'pot-au-feu', 'tartiflette', 'raclette'];
            return cat === 'cest-lhiver' || 
                   tags.some(t => winterKeywords.some(k => t.toLowerCase().includes(k))) ||
                   winterKeywords.some(k => title.toLowerCase().includes(k));
        }
        if (catId === 'glaces') {
            return cat === 'glaces' || tags.some(t => t.includes('glace') || t.includes('sorbet') || t.includes('gelato'));
        }
        if (catId === 'rafraichissements') {
            return cat === 'rafraichissements' || tags.some(t => t.includes('rafra'));
        }
        if (catId === 'noel') {
            return tags.some(t => t.toLowerCase().includes('noël') || t.toLowerCase().includes('noel'));
        }
        if (catId === 'paques') {
            return tags.some(t => t.toLowerCase().includes('pâques') || t.toLowerCase().includes('paques') || t.toLowerCase().includes('agneau'));
        }
        if (catId === 'simplissime') {
            return tags.some(t => t.toLowerCase().includes('simplissime'));
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

        // 3. Fallback Match classique
        const isMatch = cat.includes(catId) || 
                       catId.includes(cat) || 
                       tags.some(t => t.includes(catId) || catId.includes(t.toLowerCase()));
        
        if ((catId === 'patisserie' || catId === 'desserts') && isSavory) return false;

        return isMatch;
    });

    return (
        <CategoryClient 
            id={id} 
            category={category} 
            recipes={recipes} 
            categories={categories} 
        />
    );
}

// Génération statique des chemins de catégories
export async function generateStaticParams() {
    return Object.keys(categories).map((id) => ({
        id: id,
    }));
}
