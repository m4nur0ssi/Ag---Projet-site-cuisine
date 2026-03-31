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
        
        if (id === 'vegetarien') {
            return tags.some(t => t.includes('végé') || t.includes('vege') || t.includes('vegetarien')) || cat === 'vegetarien';
        }
        
        return cat === id || tags.includes(id);
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
