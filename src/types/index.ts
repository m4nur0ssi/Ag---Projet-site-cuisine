export interface Recipe {
    id: string;
    title: string;
    description: string;
    image: string;
    category: 'aperitifs' | 'entrees' | 'plats' | 'desserts' | 'patisserie' | 'restaurant' | 'vegetarien' | 'glaces' | 'boissons' | 'facile' | 'boulangerie' | 'sauces' | 'petit-dejeuner';

    difficulty: 'facile' | 'moyen' | 'difficile';
    prepTime: number; // minutes
    cookTime: number; // minutes
    servings: number;
    videoHtml?: string;
    ingredients: Ingredient[];
    steps: string[];
    tags?: string[]; // Tags/mots-clés WordPress
    isFeatured?: boolean;
    isFavorite?: boolean;
    isVoted?: boolean;
    votes?: number;
    address?: string;
}


export interface Ingredient {
    name: string;
    quantity: string;
    image?: string; // URL de la photo de l'ingrédient
    checked?: boolean;
}

export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export interface UserProfile {
    name: string;
    level: number;
    title: string;
    avatar: string;
    stats: {
        recipesMastered: number;
        aperitifsPrepared: number; // Renommé de potionsBrewed
        favorites: number;
    };
    badges: Badge[];
    recentActivity: RecentActivity[];
}

export interface Badge {
    id: string;
    name: string;
    icon: string;
    unlocked: boolean;
}

export interface RecentActivity {
    recipeId: string;
    recipeName: string;
    image: string;
    completedAt: string;
}
