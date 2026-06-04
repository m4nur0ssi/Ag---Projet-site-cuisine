'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';

export default function RandomPage() {
    const router = useRouter();

    useEffect(() => {
        if (mockRecipes && mockRecipes.length > 0) {
            const randomIndex = Math.floor(Math.random() * mockRecipes.length);
            const randomRecipe = mockRecipes[randomIndex];
            // Redirection immédiate vers la fiche complète
            router.replace(`/recipe/${randomRecipe.id}`);
        } else {
            router.replace('/');
        }
    }, [router]);

    return null; // Rien n'est affiché pour une transition instantanée
}
