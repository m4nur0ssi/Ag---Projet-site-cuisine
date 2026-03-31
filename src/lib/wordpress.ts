import { Recipe } from '@/types';

const WORDPRESS_API_URL = 'http://lesrec3ttesm4giques.fr/wp-json/wp/v2';

interface WordPressPost {
    id: number;
    title: { rendered: string };
    content: { rendered: string };
    excerpt: { rendered: string };
    featured_media: number;
    categories: number[];
    acf?: any; // Advanced Custom Fields
}

interface WordPressMedia {
    id: number;
    source_url: string;
    alt_text: string;
}

/**
 * Fetch all recipes from WordPress
 */
export async function fetchRecipes(): Promise<Recipe[]> {
    try {
        const fetchOptions: RequestInit = {
            next: { revalidate: 60 }, // Cache for 1 minute (faster in dev)
            // @ts-ignore - Node.js specific option
            ...(process.env.NODE_ENV === 'development' && {
                agent: undefined
            })
        };
        const response = await fetch(`${WORDPRESS_API_URL}/posts?per_page=100&_embed`, fetchOptions);

        if (!response.ok) {
            console.error('Failed to fetch recipes from WordPress');
            return [];
        }

        const posts: WordPressPost[] = await response.json();

        return posts.map(post => convertWordPressToRecipe(post));
    } catch (error) {
        console.error('Error fetching WordPress recipes:', error);
        return [];
    }
}

/**
 * Fetch a single recipe by ID
 */
export async function fetchRecipeById(id: string): Promise<Recipe | null> {
    try {
        const response = await fetch(`${WORDPRESS_API_URL}/posts/${id}?_embed`, {
            next: { revalidate: 60 } // Cache for 1 minute
        });

        if (!response.ok) {
            return null;
        }

        const post: WordPressPost = await response.json();
        return convertWordPressToRecipe(post);
    } catch (error) {
        console.error('Error fetching recipe:', error);
        return null;
    }
}

/**
 * Convert WordPress post to Recipe format
 */
function convertWordPressToRecipe(post: WordPressPost): Recipe {
    // Extract data from ACF (Advanced Custom Fields) if available
    const acf = post.acf || {};

    // Parse ingredients from content or ACF
    const ingredients = parseIngredients(acf.ingredients || post.content.rendered);

    // Parse steps from content or ACF
    const steps = parseSteps(acf.steps || post.content.rendered);

    // Get featured image
    const featuredImage = (post as any)._embedded?.['wp:featuredmedia']?.[0]?.source_url || '';

    // Determine category
    const category = determineCategoryFromPost(post);

    return {
        id: post.id.toString(),
        title: stripHtml(post.title.rendered),
        description: stripHtml(post.excerpt.rendered),
        image: featuredImage,
        category: category,
        difficulty: acf.difficulty || 'moyen',
        prepTime: parseInt(acf.prep_time) || 15,
        cookTime: parseInt(acf.cook_time) || 30,
        servings: parseInt(acf.servings) || 4,
        ingredients: ingredients,
        steps: steps,
        isFeatured: acf.is_featured || false,
        isFavorite: false
    };
}

/**
 * Parse ingredients from HTML content (supports Meal Planner Pro)
 */
function parseIngredients(content: string): Array<{ name: string; quantity: string }> {
    // Try to find Meal Planner Pro ingredients section
    const mealPlannerMatch = content.match(/<h[23][^>]*>Ingr[ée]dients<\/h[23]>([\s\S]*?)(?=<h[23]|$)/i);
    const ingredientSection = mealPlannerMatch ? mealPlannerMatch[1] : content;

    // Extract list items
    const ingredientRegex = /<li[^>]*>(.*?)<\/li>/gi;
    const matches = ingredientSection.match(ingredientRegex);

    if (!matches) return [];

    return matches.map(match => {
        const text = stripHtml(match).trim();

        // Skip empty or very short items
        if (text.length < 2) return null;

        // Try to split quantity and name
        // Formats: "Du sel", "De 1'huile d'olive", "Quelques carottes"
        const quantityMatch = text.match(/^(Du|De|Quelques|Des?)\s+(.+)$/i);

        if (quantityMatch) {
            return {
                quantity: quantityMatch[1],
                name: quantityMatch[2].trim()
            };
        }

        // Try numeric format: "200g de farine"
        const numericMatch = text.match(/^([\d\s.,]+[a-zA-Zéè°]*)[\s]+(?:de\s+)?(.+)$/i);

        if (numericMatch) {
            return {
                quantity: numericMatch[1].trim(),
                name: numericMatch[2].trim()
            };
        }

        return {
            quantity: '',
            name: text
        };
    }).filter(Boolean) as Array<{ name: string; quantity: string }>;
}

/**
 * Parse cooking steps from HTML content (supports Meal Planner Pro)
 */
function parseSteps(content: string): string[] {
    // Try to find Meal Planner Pro instructions section
    const mealPlannerMatch = content.match(/<h[23][^>]*>(?:Instructions|Conseils de pr[ée]paration)<\/h[23]>([\s\S]*?)(?=<h[23]|$)/i);
    const stepsSection = mealPlannerMatch ? mealPlannerMatch[1] : content;

    // Extract list items or paragraphs
    const stepRegex = /<(?:li|p)[^>]*>(.*?)<\/(?:li|p)>/gi;
    const matches = stepsSection.match(stepRegex);

    if (!matches) return [];

    return matches
        .map(match => stripHtml(match).trim())
        .filter(step => step.length > 10); // Filter out very short steps
}


/**
 * Determine recipe category from WordPress categories
 */
function determineCategoryFromPost(post: WordPressPost): 'entrees' | 'plats' | 'desserts' | 'aperitifs' {
    const categories = (post as any)._embedded?.['wp:term']?.[0] || [];
    const categoryNames = categories.map((cat: any) => cat.name.toLowerCase());

    if (categoryNames.some((name: string) => name.includes('entrée') || name.includes('entree'))) {
        return 'entrees';
    }
    if (categoryNames.some((name: string) => name.includes('plat') || name.includes('principal'))) {
        return 'plats';
    }
    if (categoryNames.some((name: string) => name.includes('dessert'))) {
        return 'desserts';
    }
    if (categoryNames.some((name: string) => name.includes('boisson') || name.includes('potion'))) {
        return 'aperitifs';
    }

    return 'plats'; // Default
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
}

/**
 * Fetch WordPress categories
 */
export async function fetchCategories() {
    try {
        const response = await fetch(`${WORDPRESS_API_URL}/categories`, {
            next: { revalidate: 86400 } // Cache for 24 hours
        });

        if (!response.ok) {
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching categories:', error);
        return [];
    }
}
