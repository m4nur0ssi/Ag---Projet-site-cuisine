'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { mockRecipes } from '@/data/mockData';
import { decodeHtml } from '@/lib/utils';
import styles from './ResumeRecipe.module.css';

export default function ResumeRecipe() {
    const [recipe, setRecipe] = useState<any>(null);

    useEffect(() => {
        const activeId = window.localStorage.getItem('active-recipe-id');
        if (activeId) {
            const found = mockRecipes.find(r => r.id === activeId);
            if (found) {
                setRecipe(found);
            }
        }
    }, []);

    if (!recipe) return null;

    return (
        <Link href={`/recipe/${recipe.id}`} className={styles.banner}>
            <div className={styles.content}>
                <span className={styles.icon}>🍳</span>
                <div className={styles.textGroup}>
                    <div className={styles.label}>Continuer ma cuisine</div>
                    <div className={styles.title}>{decodeHtml(recipe.title)}</div>
                </div>
            </div>
            <div className={styles.chevron}>→</div>
        </Link>
    );
}
