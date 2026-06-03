'use client';
import { useEffect, useState } from 'react';

/**
 * Icône calendrier (style flat) dont le numéro = jour J, synchronisé chaque jour.
 * Le mois (abrégé FR) se met aussi à jour automatiquement.
 */
export default function PlannerIcon({ size = 26 }: { size?: number }) {
    const [today, setToday] = useState<{ day: number; month: string } | null>(null);

    useEffect(() => {
        const compute = () => {
            const d = new Date();
            const month = d.toLocaleDateString('fr-FR', { month: 'short' })
                .replace('.', '').toUpperCase();
            setToday({ day: d.getDate(), month });
        };
        compute();
        const id = setInterval(compute, 60 * 60 * 1000); // refresh chaque heure
        return () => clearInterval(id);
    }, []);

    return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-label="Planificateur" role="img">
            {/* Corps blanc */}
            <rect x="8" y="14" width="84" height="80" rx="14" fill="#ffffff" />
            {/* Bandeau rouge (coins hauts arrondis) */}
            <path d="M8 42 V28 A14 14 0 0 1 22 14 H78 A14 14 0 0 1 92 28 V42 Z" fill="#e8483f" />
            {/* Anneaux */}
            <rect x="29" y="6" width="9" height="24" rx="4.5" fill="#3c4b53" />
            <rect x="62" y="6" width="9" height="24" rx="4.5" fill="#3c4b53" />
            {today && (
                <>
                    <text x="50" y="60" textAnchor="middle" fontSize="15" fontWeight="700"
                        fill="#3c4b53" fontFamily="-apple-system, Helvetica, Arial, sans-serif"
                        letterSpacing="0.5">{today.month}</text>
                    <text x="50" y="90" textAnchor="middle" fontSize="38" fontWeight="800"
                        fill="#3c4b53" fontFamily="-apple-system, Helvetica, Arial, sans-serif">{today.day}</text>
                </>
            )}
        </svg>
    );
}
