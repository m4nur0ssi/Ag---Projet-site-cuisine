'use client';

/**
 * Écran « Connecte-toi » façon Apple TV+ — cohérent avec l'accueil desktop.
 * Fond cinéma (photos de recettes floutées), carte de verre centrée, cadenas
 * dessiné, bouton de connexion. Utilisé par le planificateur, la liste de
 * courses et les favoris quand l'utilisateur n'est pas connecté.
 */

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { mockRecipes } from '@/mobile/data/mockData';
import { useAuth } from '@/hooks/useAuth';
import styles from './tvAuthGate.module.css';

export default function TVAuthGate({
    title = 'Connecte-toi',
    subtitle,
}: {
    title?: string;
    subtitle: string;
}) {
    const router = useRouter();
    // Connexion DIRECTE : sur ces pages gatées, aucun AuthButton n'est monté pour
    // capter `magic-open-auth` — le bouton lançait donc la connexion dans le vide.
    const { signInWithGoogle } = useAuth();

    // Quelques photos pour la mosaïque de fond, floutée à l'excès : de la matière,
    // pas une image lisible. Mémorisé pour ne pas rebrasser à chaque rendu.
    const tiles = useMemo(
        () => mockRecipes.filter((r) => r.image && r.category !== 'restaurant').slice(0, 9),
        []
    );

    return (
        <div className={styles.gate}>
            {/* Fond cinéma : grille de photos très floutées + voile sombre. */}
            <div className={styles.backdrop} aria-hidden>
                <div className={styles.tiles}>
                    {tiles.map((r) => (
                        <div key={r.id} className={styles.tile} style={{ backgroundImage: `url(${r.image})` }} />
                    ))}
                </div>
                <div className={styles.veil} />
            </div>

            {/* Signature en haut, comme l'accueil. */}
            <button className={styles.brand} onClick={() => router.push('/')} aria-label="Retour à l'accueil">
                <span className={styles.brandKicker}>Les recettes</span>
                <span className={styles.brandWord}>Magiques</span>
            </button>

            {/* Carte de verre centrale. */}
            <div className={styles.card}>
                <div className={styles.lock}>
                    <svg viewBox="0 0 24 24" width="30" height="30" fill="none">
                        <rect x="5" y="10.5" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.7" />
                        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                        <circle cx="12" cy="15" r="1.4" fill="currentColor" />
                    </svg>
                </div>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.subtitle}>{subtitle}</p>
                <button className={styles.cta} onClick={() => signInWithGoogle()}>
                    Se connecter
                </button>
                <button className={styles.back} onClick={() => router.push('/')}>
                    Retour à l&apos;accueil
                </button>
            </div>
        </div>
    );
}
