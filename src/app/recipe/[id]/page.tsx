import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { mockRecipes } from '@/data/mockData';
import type { Recipe } from '@/types';
import FicheOuverte from './FicheOuverte';
import { estimateRecipeTiming } from '@/lib/recipe-timing';

const BASE = 'https://www.lesrecettesmagiques.fr';

// Transforme une image (souvent /api/image-proxy?...) en URL absolue crawlable.
function absoluteImage(src?: string): string | undefined {
    if (!src) return undefined;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `${BASE}${src.startsWith('/') ? '' : '/'}${src}`;
}

// Nettoie un libellé d'ingrédient (emoji + retours ligne + espaces multiples).
function cleanText(s: string): string {
    return (s || '').replace(/\s+/g, ' ').trim();
}

// minutes -> durée ISO 8601 (PT#M), attendue par le schéma Recipe.
function isoDuration(min?: number): string | undefined {
    if (!min || min <= 0) return undefined;
    return `PT${min}M`;
}

// Construit le JSON-LD Recipe. Renvoie null pour un restaurant ou une fiche vide.
function buildRecipeJsonLd(recipe: Recipe) {
    if (recipe.category === 'restaurant' || recipe.address) return null;
    if (!recipe.ingredients?.length || !recipe.steps?.length) return null;

    const jsonLd: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: recipe.title,
        description: recipe.description,
        recipeCategory: recipe.category,
        url: `${BASE}/recipe/${recipe.id}`,
        recipeIngredient: recipe.ingredients.map(i => cleanText(i.name)).filter(Boolean),
        recipeInstructions: recipe.steps.map((step, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            text: cleanText(step),
        })),
    };

    const image = absoluteImage(recipe.image);
    if (image) jsonLd.image = [image];
    if (recipe.servings) jsonLd.recipeYield = `${recipe.servings} portions`;

    // Temps ESTIMÉS depuis les étapes : les champs WordPress valent 15 + 30 sur
    // les 617 recettes (valeurs par défaut du sync). Publier « PT45M » partout,
    // c'est envoyer une donnée fausse à Google sur chaque fiche.
    const est = estimateRecipeTiming(recipe.steps);
    const prepMin = est.prepTime + est.cookTime > 0 ? est.prepTime : (recipe.prepTime || 0);
    const cookMin = est.prepTime + est.cookTime > 0 ? est.cookTime : (recipe.cookTime || 0);
    const prep = isoDuration(prepMin);
    const cook = isoDuration(cookMin);
    if (prep) jsonLd.prepTime = prep;
    if (cook) jsonLd.cookTime = cook;
    const total = prepMin + cookMin;
    if (total > 0) jsonLd.totalTime = `PT${total}M`;

    return jsonLd;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
    const recipe = mockRecipes.find(r => String(r.id) === String(params.id));
    if (!recipe) return { title: 'Recette introuvable' };

    const image = absoluteImage(recipe.image);
    const description = (recipe.description || '').slice(0, 160);

    return {
        title: recipe.title,
        description,
        keywords: [recipe.title, 'recette', recipe.category, ...(recipe.tags || [])],
        alternates: { canonical: `/recipe/${recipe.id}` },
        openGraph: {
            type: 'article',
            url: `${BASE}/recipe/${recipe.id}`,
            title: recipe.title,
            description,
            images: image ? [image] : undefined,
        },
        // Grande image dans l'aperçu des liens partagés (Messages, WhatsApp, X…).
        twitter: { card: 'summary_large_image', title: recipe.title, description, images: image ? [image] : undefined },
    };
}

export default async function RecipePage({ params }: { params: { id: string } }) {
    const recipe = mockRecipes.find(r => String(r.id) === String(params.id));

    if (!recipe) {
        notFound();
    }

    const jsonLd = buildRecipeJsonLd(recipe);
    const image = absoluteImage(recipe.image);
    const ingredients = (recipe.ingredients || []).map(i => cleanText(i.name)).filter(Boolean);
    const etapes = (recipe.steps || []).map(s => cleanText(s)).filter(Boolean);

    /*
     * La fiche reste lisible telle quelle, sans JavaScript : titre, photo,
     * ingrédients et étapes sont dans le HTML. La fiche interactive s'ouvre
     * par-dessus (FicheOuverte), sans redirection vers l'accueil.
     */
    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <article className="fiche-seo" style={{ padding: '24px 16px', maxWidth: 760, margin: '0 auto' }}>
                <h1>{recipe.title}</h1>
                {recipe.description && <p>{cleanText(recipe.description)}</p>}
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt={recipe.title} width={760} height={1004} style={{ width: '100%', height: 'auto' }} />
                )}
                {ingredients.length > 0 && (
                    <section>
                        <h2>Ingrédients</h2>
                        <ul>{ingredients.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </section>
                )}
                {etapes.length > 0 && (
                    <section>
                        <h2>Étapes</h2>
                        <ol>{etapes.map((t, i) => <li key={i}>{t}</li>)}</ol>
                    </section>
                )}
            </article>
            <FicheOuverte id={String(recipe.id)} />
        </>
    );
}

export async function generateStaticParams() {
    return mockRecipes.map((recipe) => ({
        id: recipe.id,
    }));
}
