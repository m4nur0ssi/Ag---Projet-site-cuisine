'use client';

import { useState } from 'react';
import { carrefourTerm } from '@/lib/ingredients';
import type { ConsolItem } from '@/lib/ingredients';
import styles from './ShopActions.module.css';

interface ShopActionsProps {
    items: ConsolItem[];
    title?: string;
    size?: 'sm' | 'md';
    checkedKeys?: Set<string>; // ingrédients cochés (sélectionnés) → cible de Carrefour/partage
    onShopped?: (item: ConsolItem) => void; // recherché sur Carrefour → rayer au retour
}

// Boutons Partager + Carrefour. Si des ingrédients sont cochés, ils sont la cible
// (du haut vers le bas) ; sinon on prend toute la liste.
export default function ShopActions({ items, title = 'Ma liste de courses', size = 'sm', checkedKeys, onShopped }: ShopActionsProps) {
    const [idx, setIdx] = useState<number | null>(null);

    // Cible = items cochés (dans l'ordre d'affichage), sinon tout.
    const targeted = checkedKeys && checkedKeys.size
        ? items.filter(it => it.keys.some(k => checkedKeys.has(k)))
        : items;
    const list = targeted.length ? targeted : items;
    if (!list.length) return null;

    const text = `🛒 ${title}\n\n` + list.map(i => `• ${i.display}`).join('\n');

    const share = async () => {
        if (typeof navigator !== 'undefined' && (navigator as any).share) {
            try { await (navigator as any).share({ title, text }); } catch { /* partage annulé : ne rien faire */ }
            return; // ne PAS retomber sur WhatsApp si l'utilisateur annule
        }
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };
    const openCarrefour = (i: number) => {
        const it = list[i];
        if (!it) return;
        window.open(`https://www.carrefour.fr/s?q=${encodeURIComponent(carrefourTerm(it.name))}`, 'carrefourCart');
        onShopped?.(it);
    };
    const go = (i: number) => { const n = Math.max(0, Math.min(i, list.length - 1)); setIdx(n); openCarrefour(n); };

    return (
        <>
            <div className={`${styles.bar} ${size === 'md' ? styles.barMd : ''}`}>
                <button className={styles.shareBtn} onClick={(e) => { e.stopPropagation(); share(); }}>↗ Partager</button>
                <button className={styles.carreBtn} onClick={(e) => { e.stopPropagation(); setIdx(0); openCarrefour(0); }}>🛒 Carrefour</button>
            </div>

            {idx !== null && list[idx] && (
                <div className={styles.stepper} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.stepHead}>
                        <span>🛒 CARREFOUR · {idx + 1}/{list.length}</span>
                        <button className={styles.stepClose} onClick={() => setIdx(null)}>✕</button>
                    </div>
                    <div className={styles.stepBody}>
                        <span className={styles.stepIcon}>{list[idx].icon}</span>
                        <span className={styles.stepName}>{list[idx].display}</span>
                    </div>
                    <div className={styles.stepNav}>
                        <button className={styles.stepArrow} onClick={() => go(idx - 1)} disabled={idx === 0}>◀</button>
                        <button className={styles.stepSearch} onClick={() => openCarrefour(idx)}>Rechercher sur Carrefour</button>
                        {idx < list.length - 1
                            ? <button className={styles.stepNext} onClick={() => go(idx + 1)}>Suivant ▶</button>
                            : <button className={styles.stepDone} onClick={() => setIdx(null)}>Terminé ✓</button>}
                    </div>
                </div>
            )}
        </>
    );
}
