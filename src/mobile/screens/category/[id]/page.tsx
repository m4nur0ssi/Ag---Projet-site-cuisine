import { mockRecipes } from '@/mobile/data/mockData';
import CategoryClient from './CategoryClient';
import { notFound } from 'next/navigation';

const categories = {
    'aperitifs': { name: 'Apéritifs', icon: '🍹' },
    'entrees': { name: 'Entrées', icon: '🥗' },
    'plats': { name: 'Plats', icon: '🍲' },
    'vegetarien': { name: 'Végétarien', icon: '🥬' },
    'desserts': { name: 'Desserts', icon: '🍰' },
    'patisserie': { name: 'Pâtisserie', icon: '🥐' },
    'restaurant': { name: 'Restaurant', icon: '🍽️' }
};

export default function CategoryPage({ params }: { params: { id: string } }) {
    const id = params.id;
    const category = categories[id as keyof typeof categories];

    if (!category) {
        notFound();
    }

    // Filtrage robuste des recettes
    const recipes = mockRecipes.filter(r => {
        if (!r) return false;
        const tags = r.tags?.map(t => t.toLowerCase()) || [];
        const cat = r.category?.toLowerCase();
        const titleLower = (r.title || '').toLowerCase();

        if (id === 'vegetarien') {
            return tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || cat === 'vegetarien';
        }

        if (id === 'patisserie') {
            // 1. Catégorie ou tag explicite
            if (cat === 'patisserie') return true;
            if (tags.some(t => t.includes('pâtiss') || t.includes('patis'))) return true;
            // 2. Mots-clés pâtisserie dans le titre (≠ desserts simples)
            const pastryKeywords = [
                'gâteau', 'gateau', 'cake', 'cookie', 'macaron', 'tarte', 'brioche',
                'choux', 'éclair', 'eclair', 'millefeuille', 'viennoiserie', 'bambas',
                'brookie', 'financier', 'muffin', 'brownie', 'fondant', 'moelleux',
                'madeleine', 'beignet', 'chouquette', 'cupcake', 'galette', 'bûche', 'buche',
                'babka', 'croissant', 'crumble', 'clafoutis', 'pain d\'épices', 'charlotte'
            ];
            // Exclure les plats salés
            const savoryCheck = ['poulet', 'viande', 'agneau', 'bœuf', 'boeuf', 'poisson', 'saumon',
                                 'crevette', 'jambon', 'fromage', 'gratin', 'pizza', 'quiche'];
            const isSavory = savoryCheck.some(k => titleLower.includes(k));
            return !isSavory && pastryKeywords.some(k => titleLower.includes(k));
        }

        if (id === 'desserts') {
            // Exclure les pâtisseries "élaborées" → juste les desserts simples
            if (cat === 'desserts') return true;
            if (tags.some(t => t.includes('dessert'))) return true;
            const dessertKeywords = [
                'tiramisu', 'mousse', 'compote', 'yaourt', 'panna cotta',
                'salade de fruit', 'verrine', 'flan', 'crêpe', 'crepe', 'gaufre', 'pancake',
                'entremets', 'soufflé', 'profiterole', 'churros', 'riz au lait',
                'fondue au chocolat', 'caramel', 'pavlova', 'nougat'
            ];
            const pastryKeywords = ['gâteau', 'gateau', 'cake', 'cookie', 'macaron', 'tarte', 'brioche',
                'brownie', 'muffin', 'cupcake', 'fondant', 'moelleux', 'financier', 'beignet'];
            const isBaking = cat === 'patisserie' || pastryKeywords.some(k => titleLower.includes(k));
            return !isBaking && dessertKeywords.some(k => titleLower.includes(k));
        }

        if (id === 'entrees') {
            // Priorité au champ category
            if (cat === 'entrees' || cat === 'entrée') return true;
            if (tags.some(t => t === 'entrées' || t === 'entrees' || t === 'entrée')) return true;
            // Mots-clés entrées (hors apéritifs)
            const savoryMain = ['poulet', 'agneau', 'bœuf', 'boeuf', 'rôti', 'burger', 'pâtes', 'riz'];
            const isMain = savoryMain.some(k => titleLower.includes(k));
            return !isMain && ['salade', 'soupe', 'velouté', 'carpaccio', 'tartare'].some(k => titleLower.includes(k));
        }

        return cat === id || tags.some(t => t === id);
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
