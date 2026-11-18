import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { categoriesIndexables, nomCategorie, recettesDe } from '@/lib/categories-seo';

const BASE = 'https://www.lesrecettesmagiques.fr';

export function generateStaticParams() {
    return categoriesIndexables().map((c) => ({ categorie: c.slug }));
}

export async function generateMetadata({ params }: { params: { categorie: string } }): Promise<Metadata> {
    const nom = nomCategorie(params.categorie);
    if (!nom) return { title: 'Catégorie introuvable' };
    const n = recettesDe(params.categorie).length;
    const description = `${n} recettes de ${nom.toLowerCase()} faciles et gourmandes, avec ingrédients et étapes.`.slice(0, 160);
    return {
        title: `${nom} : recettes faciles`,
        description,
        alternates: { canonical: `/recettes/${params.categorie}` },
        openGraph: { title: `${nom} : recettes faciles`, description, url: `${BASE}/recettes/${params.categorie}` },
    };
}

export default function CategoriePage({ params }: { params: { categorie: string } }) {
    const nom = nomCategorie(params.categorie);
    if (!nom) notFound();
    const recettes = recettesDe(params.categorie);

    // Liste de liens réels vers chaque fiche : c'est ce qui fait découvrir les recettes.
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${nom} : recettes faciles`,
        numberOfItems: recettes.length,
        itemListElement: recettes.map((r, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${BASE}/recipe/${r.id}`,
            name: r.title,
        })),
    };

    return (
        <main style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            <nav aria-label="Fil d'Ariane" style={{ fontSize: 14, marginBottom: 12 }}>
                <a href="/">Accueil</a> › <span>{nom}</span>
            </nav>
            <h1>{nom} : recettes faciles</h1>
            <p>
                {recettes.length} recettes de {nom.toLowerCase()}, avec ingrédients et étapes. Cliquez sur une recette pour la voir en détail.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
                {recettes.map((r) => (
                    <li key={r.id}>
                        <a href={`/recipe/${r.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={r.image}
                                alt={r.title}
                                width={760}
                                height={1004}
                                loading="lazy"
                                decoding="async"
                                style={{ width: '100%', height: 'auto', aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 12 }}
                            />
                            <span style={{ display: 'block', marginTop: 6, fontWeight: 600 }}>{r.title}</span>
                        </a>
                    </li>
                ))}
            </ul>
        </main>
    );
}
