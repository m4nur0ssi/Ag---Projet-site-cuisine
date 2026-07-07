export interface Recipe {
    id: string;
    title: string;
    description: string;
    image: string;
    category: 'aperitifs' | 'entrees' | 'plats' | 'desserts' | 'patisserie' | 'restaurant' | 'vegetarien' | 'glaces' | 'rafraichissements' | 'boissons' | 'facile' | 'boulangerie' | 'sauces' | 'petit-dejeuner' | 'simplissime' | 'pâques' | 'noël' | 'voila-lete' | 'cest-lhiver';

    difficulty: 'facile' | 'moyen' | 'difficile';
    prepTime: number; // minutes
    cookTime: number; // minutes
    servings: number;
    video?: string;
    videoHtml?: string;
    tiktokHandle?: string;      // @pseudo du créateur (sans @), clé vers influencers.json
    tiktokAuthorUrl?: string;   // lien direct vers la page TikTok du créateur
    ingredients: Ingredient[];
    steps: string[];
    tags?: string[]; // Tags/mots-clés WordPress
    isFeatured?: boolean;
    isFavorite?: boolean;
    isVoted?: boolean;
    votes?: number;
    address?: string;
    website?: string;
    reviews?: Review[];
    restaurant?: RestaurantInfo;
}

// Fiche restaurant ("Comme au resto") — infos réelles vérifiées.
export interface RestaurantInfo {
    subType?: 'brasserie' | 'italien' | 'asiatique' | 'gastro' | 'salon-de-the';
    priceLevel?: 1 | 2 | 3;
    parking?: boolean;
    terrace?: boolean;
    rating?: number;
    reviewsCount?: number;
    tripAdvisorUrl?: string;
    website?: string;
    hours?: string;
    address?: string;
    phone?: string;
    photos?: string[];
}

export interface Review {
    author: string;
    rating: number; // 0-5
    content: string;
    date: string;
    avatar?: string;
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
